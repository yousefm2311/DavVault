import { ExtractedEntity } from '../parser.service';

export class RegexParser {
  /**
   * Legacy regex-based fallback extraction.
   */
  public parse(content: string, language: string): any[] {
    // Guard: return empty safely on non-string input
    if (typeof content !== 'string') {
      return [];
    }

    const entities: any[] = [];
    const lines = content.split('\n');

    try {
      if (['javascript', 'typescript', 'javascript-react', 'typescript-react'].includes(language)) {
        this.parseJSOrTS(lines, content, entities);
      } else if (language === 'python') {
        this.parsePython(lines, content, entities);
      } else if (language === 'dart') {
        this.parseDart(lines, content, entities);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[RegexParser]: Extraction error for language '${language}' — ${msg}`);
      // Return whatever was collected before the error
    }

    return entities;
  }

  private parseJSOrTS(lines: string[], content: string, entities: any[]) {
    // 1. Extract Classes
    const classRegex = /(?:export\s+)?class\s+([a-zA-Z0-9_]+)/g;
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
        dependencies: this.extractJSDependencies(code),
        confidence: 0.6,
        parser: 'regex'
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
        confidence: 0.6,
        parser: 'regex'
      });
    }

    // 3. Extract Express Routes
    const routeRegex = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];
      const startIdx = match.index;
      const startLine = content.substring(0, startIdx).split('\n').length;
      
      const endLine = Math.min(startLine + 20, lines.length);
      const code = lines.slice(startLine - 1, endLine).join('\n');

      entities.push({
        name: `${method} ${path}`,
        type: 'route',
        code,
        startLine,
        endLine,
        dependencies: [],
        confidence: 0.6,
        parser: 'regex'
      });
    }
  }

  private parsePython(lines: string[], content: string, entities: any[]) {
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
        confidence: 0.6,
        parser: 'regex'
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
        confidence: 0.6,
        parser: 'regex'
      });
    }
  }

  private parseDart(lines: string[], content: string, entities: any[]) {
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
        confidence: 0.6,
        parser: 'regex'
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
    const baseIndentation = baseLine.search(/\S/);
    
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      
      const indentation = line.search(/\S/);
      if (indentation !== -1 && indentation <= baseIndentation) {
        return i;
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
