export interface ExtractedEntity {
  name: string;
  type: 'function' | 'class' | 'route' | 'model' | 'service' | 'controller';
  code: string;
  startLine: number;
  endLine: number;
  dependencies: string[];
}

export interface ProjectMetadata {
  language: string;
  framework: string;
  database: string;
  architectureType: string;
}

class ParserService {
  detectLanguage(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
        return 'javascript';
      case 'jsx':
        return 'javascript-react';
      case 'ts':
        return 'typescript';
      case 'tsx':
        return 'typescript-react';
      case 'py':
        return 'python';
      case 'dart':
        return 'dart';
      case 'php':
        return 'php';
      case 'java':
        return 'java';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'yml':
      case 'yaml':
        return 'yaml';
      case 'env':
        return 'env';
      default:
        return 'text';
    }
  }

  detectFrameworkAndDB(files: { path: string; content: string }[]): {
    framework: string;
    database: string;
    language: string;
  } {
    let framework = 'vanilla';
    let database = 'none';
    let language = 'javascript';

    // Count extensions to find dominant language
    const counts: Record<string, number> = {};
    for (const file of files) {
      const lang = this.detectLanguage(file.path);
      counts[lang] = (counts[lang] || 0) + 1;

      // Look inside package.json
      if (file.path.endsWith('package.json')) {
        try {
          const pkg = JSON.parse(file.content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          if (deps['express']) framework = 'express';
          else if (deps['@nestjs/core']) framework = 'nestjs';
          else if (deps['next']) framework = 'nextjs';
          else if (deps['react']) framework = 'react';

          if (deps['mongoose'] || deps['mongodb']) database = 'mongodb';
          else if (deps['pg'] || deps['sequelize']) database = 'postgresql';
          else if (deps['@supabase/supabase-js']) database = 'supabase';
          else if (deps['mysql2'] || deps['mysql']) database = 'mysql';
        } catch (e) {}
      }

      // Look inside pubspec.yaml
      if (file.path.endsWith('pubspec.yaml')) {
        language = 'dart';
        framework = 'flutter';
        if (file.content.includes('supabase')) database = 'supabase';
        if (file.content.includes('firebase')) database = 'firebase_firestore';
      }

      // Look inside requirements.txt or pipfile
      if (file.path.endsWith('requirements.txt')) {
        language = 'python';
        if (file.content.includes('django')) framework = 'django';
        else if (file.content.includes('flask')) framework = 'flask';
        else if (file.content.includes('fastapi')) framework = 'fastapi';
      }
    }

    // Set dominant language if not set
    const sortedLangs = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sortedLangs.length > 0 && sortedLangs[0][0] !== 'text' && language === 'javascript') {
      language = sortedLangs[0][0];
    }

    return { framework, database, language };
  }

  extractEntities(content: string, language: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const lines = content.split('\n');

    // Split logic into language-specific parsers
    if (['javascript', 'typescript', 'javascript-react', 'typescript-react'].includes(language)) {
      this.parseJSOrTS(lines, content, entities);
    } else if (language === 'python') {
      this.parsePython(lines, content, entities);
    } else if (language === 'dart') {
      this.parseDart(lines, content, entities);
    }

    return entities;
  }

  private parseJSOrTS(lines: string[], content: string, entities: ExtractedEntity[]) {
    // 1. Extract Classes
    const classRegex = /(?:export\s+)?class\s+([a-zA-Z0-9_]+)/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const startIdx = match.index;
      
      // Basic curly brace matcher to find end of class
      const startLine = content.substring(0, startIdx).split('\n').length;
      const endLine = this.findMatchingBraceEnd(lines, startLine - 1);
      const code = lines.slice(startLine - 1, endLine).join('\n');

      entities.push({
        name: className,
        type: 'class',
        code,
        startLine,
        endLine,
        dependencies: this.extractJSDependencies(code),
      });
    }

    // 2. Extract Functions
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g;
    while ((match = funcRegex.exec(content)) !== null) {
      const funcName = match[1];
      const startIdx = match.index;
      const startLine = content.substring(0, startIdx).split('\n').length;
      const endLine = this.findMatchingBraceEnd(lines, startLine - 1);
      const code = lines.slice(startLine - 1, endLine).join('\n');

      entities.push({
        name: funcName,
        type: 'function',
        code,
        startLine,
        endLine,
        dependencies: this.extractJSDependencies(code),
      });
    }

    // 3. Extract Express Routes
    const routeRegex = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];
      const startIdx = match.index;
      const startLine = content.substring(0, startIdx).split('\n').length;
      
      // Get around 10 lines of context for the route if brace matcher is too complex
      const endLine = Math.min(startLine + 20, lines.length);
      const code = lines.slice(startLine - 1, endLine).join('\n');

      entities.push({
        name: `${method} ${path}`,
        type: 'route',
        code,
        startLine,
        endLine,
        dependencies: [],
      });
    }
  }

  private parsePython(lines: string[], content: string, entities: ExtractedEntity[]) {
    // Parse Python classes and functions using indentation
    const classRegex = /class\s+([a-zA-Z0-9_]+)(?:\(([^)]+)\))?:/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const startIdx = match.index;
      const startLine = content.substring(0, startIdx).split('\n').length;
      const endLine = this.findPythonBlockEnd(lines, startLine - 1);
      const code = lines.slice(startLine - 1, endLine).join('\n');

      entities.push({
        name: className,
        type: 'class',
        code,
        startLine,
        endLine,
        dependencies: [],
      });
    }

    const defRegex = /def\s+([a-zA-Z0-9_]+)\s*\(/g;
    while ((match = defRegex.exec(content)) !== null) {
      const funcName = match[1];
      const startIdx = match.index;
      const startLine = content.substring(0, startIdx).split('\n').length;
      const endLine = this.findPythonBlockEnd(lines, startLine - 1);
      const code = lines.slice(startLine - 1, endLine).join('\n');

      entities.push({
        name: funcName,
        type: 'function',
        code,
        startLine,
        endLine,
        dependencies: [],
      });
    }
  }

  private parseDart(lines: string[], content: string, entities: ExtractedEntity[]) {
    // Match Dart classes and functions (curly braces)
    const classRegex = /class\s+([a-zA-Z0-9_]+)/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const startIdx = match.index;
      const startLine = content.substring(0, startIdx).split('\n').length;
      const endLine = this.findMatchingBraceEnd(lines, startLine - 1);
      const code = lines.slice(startLine - 1, endLine).join('\n');

      entities.push({
        name: className,
        type: 'class',
        code,
        startLine,
        endLine,
        dependencies: [],
      });
    }
  }

  private findMatchingBraceEnd(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let foundBrace = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundBrace = true;
        } else if (char === '}') {
          braceCount--;
        }
      }
      if (foundBrace && braceCount <= 0) {
        return i + 1;
      }
    }
    return Math.min(startIndex + 40, lines.length);
  }

  private findPythonBlockEnd(lines: string[], startIndex: number): number {
    const baseLine = lines[startIndex];
    const baseIndentation = baseLine.search(/\S/); // spaces before first char
    
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue; // Skip empty lines
      
      const indentation = line.search(/\S/);
      if (indentation !== -1 && indentation <= baseIndentation) {
        return i; // End of block found
      }
    }
    return lines.length;
  }

  private extractJSDependencies(code: string): string[] {
    const deps: string[] = [];
    const importRegex = /(?:import|require)\s*\(?\s*["']([^"']+)["']/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      deps.push(match[1]);
    }
    return deps;
  }
}

export const parserService = new ParserService();
