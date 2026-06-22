import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Rate Limiter to protect against API abuse (brute force)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // Limit each IP to 15 authentication attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again in an hour.' },
});

// Sanitizes and validates directory paths to prevent Zip Slip (Directory Traversal)
export const safePathResolve = (baseDir: string, relativePath: string): string => {
  const resolvedPath = path.resolve(baseDir, relativePath);
  
  // Verify that the resolved path is indeed inside the baseDir
  if (!resolvedPath.startsWith(path.resolve(baseDir))) {
    throw new Error('Directory traversal attack detected!');
  }
  
  return resolvedPath;
};

// Scan code for potential secrets (AWS keys, OpenAI keys, JWT keys, database passwords)
export const scanForSecrets = (content: string): { hasSecret: boolean; redacted: string; detectedSecrets: string[] } => {
  const secretPatterns = [
    { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9]{32,48}/g },
    { name: 'Google API Key', regex: /AIzaSy[a-zA-Z0-9_-]{33}/g },
    { name: 'Generic Password/Secret Key', regex: /(?:key|secret|password|passwd|token|auth|credential)(?:\s*[:=]\s*["'])([a-zA-Z0-9_\-\.\@\#\$\%\^\&\*\(\)\+]{8,64})(?=["'])/gi },
    { name: 'Slack Webhook', regex: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]{8}\/B[a-zA-Z0-9_]{8}\/[a-zA-Z0-9_]{24}/g },
    { name: 'AWS Access Key ID', regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|APKA|ASCA|ASIA)[A-Z0-9]{16}/g }
  ];

  let hasSecret = false;
  let redacted = content;
  const detectedSecrets: string[] = [];

  for (const pattern of secretPatterns) {
    const matches = content.match(pattern.regex);
    if (matches) {
      hasSecret = true;
      for (const match of matches) {
        // Redact matches except for variables name in key-value matching
        if (pattern.name === 'Generic Password/Secret Key') {
          // Keep the variable name and replace only the matched secret value
          const parts = match.split(/[:=]/);
          if (parts.length > 1) {
            const redactedValue = parts[0] + ' = "[REDACTED_DEV_VAULT]"';
            redacted = redacted.replace(match, redactedValue);
            detectedSecrets.push(`${pattern.name} (redacted key value)`);
          }
        } else {
          redacted = redacted.replace(match, '[REDACTED_DEV_VAULT]');
          detectedSecrets.push(pattern.name);
        }
      }
    }
  }

  return { hasSecret, redacted, detectedSecrets };
};
