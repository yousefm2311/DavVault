import { JsTsParser } from './parsers/js-ts-parser';
import { RegexParser } from './parsers/regex-parser';

export interface ExtractedEntity {
  name: string;
  type: 'function' | 'class' | 'route' | 'model' | 'service' | 'controller';
  code: string;
  startLine: number;
  endLine: number;
  dependencies: string[];
  // Extracted AST specific metadata
  language?: string;
  exported?: boolean;
  async?: boolean;
  routeMethod?: string;
  routePath?: string;
  imports?: string[];
  confidence?: number;
  parser?: 'ast' | 'regex';
}

export interface ProjectMetadata {
  language: string;
  framework: string;
  database: string;
  architectureType: string;
}

class ParserService {
  private jsTsParser: JsTsParser;
  private regexParser: RegexParser;

  constructor() {
    this.jsTsParser = new JsTsParser();
    this.regexParser = new RegexParser();
  }

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
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      case 'c':
      case 'h':
        return 'c';
      case 'cpp':
      case 'hpp':
      case 'cc':
      case 'cxx':
        return 'cpp';
      case 'cs':
        return 'csharp';
      case 'rb':
        return 'ruby';
      case 'swift':
        return 'swift';
      case 'kt':
      case 'kts':
        return 'kotlin';
      case 'html':
        return 'html';
      case 'css':
      case 'scss':
      case 'sass':
      case 'less':
        return 'css';
      case 'sql':
        return 'sql';
      case 'sh':
      case 'bash':
        return 'shell';
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
    if (['javascript', 'typescript', 'javascript-react', 'typescript-react'].includes(language)) {
      try {
        // Attempt AST parsing
        return this.jsTsParser.parse(content, language);
      } catch (err) {
        // Log only the error message — never log source code
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[ParserService]: AST parsing failed for language '${language}', falling back to regex. Reason: ${msg}`);
        try {
          return this.regexParser.parse(content, language);
        } catch (fallbackErr) {
          const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          console.warn(`[ParserService]: Regex fallback also failed for language '${language}'. Reason: ${fallbackMsg}`);
          return [];
        }
      }
    }

    // Use legacy regex parser for unsupported AST languages
    try {
      return this.regexParser.parse(content, language);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ParserService]: Regex parser failed for language '${language}'. Reason: ${msg}`);
      return [];
    }
  }
}

export const parserService = new ParserService();
