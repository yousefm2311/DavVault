import * as ts from 'typescript';

export class JsTsParser {
  /**
   * Safely parses JS/TS files using the TypeScript Compiler API AST traversal.
   */
  public parse(content: string, language: string): any[] {
    // Guard: return empty safely on non-string input
    if (typeof content !== 'string' || content.trim() === '') {
      return [];
    }

    let sourceFile: ts.SourceFile;
    const entities: any[] = [];
    const imports: string[] = [];

    try {
      sourceFile = ts.createSourceFile('file.ts', content, ts.ScriptTarget.Latest, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[JsTsParser]: Failed to create SourceFile — ${msg}`);
      return [];
    }

    // First pass: extract all imports for dependency tracking
    try {
      ts.forEachChild(sourceFile, node => {
        if (ts.isImportDeclaration(node)) {
          if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            imports.push(node.moduleSpecifier.text);
          }
        }
      });
    } catch {
      // Non-fatal: proceed without imports
    }

    const visit = (node: ts.Node) => {
      try {
        // 1. Classes
        if (ts.isClassDeclaration(node) && node.name) {
          const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
          const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;
          
          entities.push({
            name: node.name.text,
            type: 'class',
            language,
            startLine: start.line + 1,
            endLine: end.line + 1,
            code: node.getText(sourceFile),
            exported: isExported,
            imports,
            dependencies: imports, // Keep legacy fields mapped
            confidence: 1.0,
            parser: 'ast'
          });
        }

        // 2. Class Methods
        if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
          const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
          const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;
          
          entities.push({
            name: node.name.text,
            type: 'function',
            language,
            startLine: start.line + 1,
            endLine: end.line + 1,
            code: node.getText(sourceFile),
            exported: false,
            async: isAsync,
            imports,
            dependencies: imports,
            confidence: 1.0,
            parser: 'ast'
          });
        }

        // 3. Named Functions
        if (ts.isFunctionDeclaration(node) && node.name) {
          const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
          const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;
          const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;
          
          entities.push({
            name: node.name.text,
            type: 'function',
            language,
            startLine: start.line + 1,
            endLine: end.line + 1,
            code: node.getText(sourceFile),
            exported: isExported,
            async: isAsync,
            imports,
            dependencies: imports,
            confidence: 1.0,
            parser: 'ast'
          });
        }

        // 4. Arrow Functions (Const Variable Assignments)
        if (ts.isVariableStatement(node)) {
          const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;
          for (const dec of node.declarationList.declarations) {
            if (dec.initializer && (ts.isArrowFunction(dec.initializer) || ts.isFunctionExpression(dec.initializer)) && ts.isIdentifier(dec.name)) {
              const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
              const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
              const isAsync = dec.initializer.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;
              
              entities.push({
                name: dec.name.text,
                type: 'function',
                language,
                startLine: start.line + 1,
                endLine: end.line + 1,
                code: node.getText(sourceFile),
                exported: isExported,
                async: isAsync,
                imports,
                dependencies: imports,
                confidence: 1.0,
                parser: 'ast'
              });
            }
          }
        }

        // 5. Express / Fastify Routes (app.get, router.post)
        if (ts.isCallExpression(node)) {
          if (ts.isPropertyAccessExpression(node.expression)) {
            const prop = node.expression;
            if (ts.isIdentifier(prop.expression) && (prop.expression.text === 'app' || prop.expression.text === 'router')) {
              const method = prop.name.text;
              if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
                if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
                  const routePath = node.arguments[0].text;
                  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
                  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
                  
                  entities.push({
                    name: `${method.toUpperCase()} ${routePath}`,
                    type: 'route',
                    language,
                    startLine: start.line + 1,
                    endLine: end.line + 1,
                    code: node.getText(sourceFile),
                    routeMethod: method.toUpperCase(),
                    routePath,
                    imports,
                    dependencies: imports,
                    confidence: 1.0,
                    parser: 'ast'
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        // Skip malformed nodes gracefully — log message only, never source code
        const msg = err instanceof Error ? err.message : String(err);
        console.debug(`[JsTsParser]: Skipped node — ${msg}`);
      }
      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
    return entities;
  }
}
