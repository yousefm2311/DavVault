import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { File as DBFile, Project } from '../models';

export const getDeveloperDNA = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const userId = req.user.id;

    // Scan user's files to analyze DNA
    const files = await DBFile.find({ userId });
    
    let backendFilesCount = 0;
    let frontendFilesCount = 0;
    let mobileFilesCount = 0;
    let devOpsFilesCount = 0;

    let camelCaseCount = 0;
    let snakeCaseCount = 0;

    const languagesMap: Record<string, number> = {};
    const frameworksMap: Record<string, number> = {};
    const databasesMap: Record<string, number> = {};

    // Analyze files
    for (const file of files) {
      const ext = file.extension.toLowerCase();
      
      // Language counts
      languagesMap[file.language || ext] = (languagesMap[file.language || ext] || 0) + 1;

      // Classify strengths based on language/extensions
      if (['py', 'java', 'php', 'go'].includes(ext) || file.path.includes('controller') || file.path.includes('server')) {
        backendFilesCount++;
      } else if (['jsx', 'tsx', 'html', 'css'].includes(ext) || file.path.includes('components') || file.path.includes('views')) {
        frontendFilesCount++;
      } else if (ext === 'dart' || file.path.includes('mobile') || file.path.includes('android')) {
        mobileFilesCount++;
      } else if (['yml', 'yaml', 'dockerfile', 'sh'].includes(ext) || file.path.includes('.github') || file.path.includes('deploy')) {
        devOpsFilesCount++;
      }

      // Check Naming Convention (Camel vs Snake)
      const content = file.content;
      // Match camelCase (camelCaseVar)
      const camelMatches = content.match(/[a-z]+[A-Z][a-zA-Z0-9]*/g);
      if (camelMatches) camelCaseCount += camelMatches.length;

      // Match snake_case (snake_case_var)
      const snakeMatches = content.match(/[a-z]+_[a-z0-9_]+/g);
      if (snakeMatches) snakeCaseCount += snakeMatches.length;
    }

    // Get project framework and db preferences
    const projects = await Project.find({ userId });
    for (const proj of projects) {
      if (proj.framework) frameworksMap[proj.framework] = (frameworksMap[proj.framework] || 0) + 1;
      if (proj.database) databasesMap[proj.database] = (databasesMap[proj.database] || 0) + 1;
    }

    // Calculate strengths percentages
    const totalTechFiles = backendFilesCount + frontendFilesCount + mobileFilesCount + devOpsFilesCount || 1;
    const backendPct = Math.max(30, Math.min(95, Math.floor((backendFilesCount / totalTechFiles) * 100)));
    const frontendPct = Math.max(25, Math.min(95, Math.floor((frontendFilesCount / totalTechFiles) * 100)));
    const mobilePct = Math.max(15, Math.min(95, Math.floor((mobileFilesCount / totalTechFiles) * 100)));
    const devOpsPct = Math.max(10, Math.min(60, Math.floor((devOpsFilesCount / totalTechFiles) * 100)));
    const aiPct = Math.min(90, Math.max(40, (frameworksMap['nextjs'] || 0) * 10 + 35));

    // Naming convention dominant
    const namingStyle = camelCaseCount > snakeCaseCount ? 'camelCase' : 'snake_case';

    // Sort maps to get favorites
    const favoriteLanguage = Object.keys(languagesMap).sort((a, b) => languagesMap[b] - languagesMap[a])[0] || 'TypeScript';
    const favoriteFramework = Object.keys(frameworksMap).sort((a, b) => frameworksMap[b] - frameworksMap[a])[0] || 'Express.js';
    const favoriteDatabase = Object.keys(databasesMap).sort((a, b) => databasesMap[b] - databasesMap[a])[0] || 'MongoDB';

    return res.status(200).json({
      favoriteStack: {
        language: favoriteLanguage,
        framework: favoriteFramework,
        database: favoriteDatabase,
      },
      strengths: {
        backend: backendPct,
        frontend: frontendPct,
        mobile: mobilePct,
        devops: devOpsPct,
        ai: aiPct,
      },
      namingStyle,
      stats: {
        camelCaseMatches: camelCaseCount,
        snakeCaseMatches: snakeCaseCount,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const compareCodeStyle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required.' });

    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const userId = req.user.id;

    // Determine target code camel vs snake ratio
    const camelMatches = code.match(/[a-z]+[A-Z][a-zA-Z0-9]*/g)?.length || 0;
    const snakeMatches = code.match(/[a-z]+_[a-z0-9_]+/g)?.length || 0;
    const codeStyle = camelMatches > snakeMatches ? 'camelCase' : 'snake_case';

    // Fetch user's DNA naming convention
    const files = await DBFile.find({ userId }, 'content');
    let userCamel = 0;
    let userSnake = 0;

    for (const file of files) {
      userCamel += file.content.match(/[a-z]+[A-Z][a-zA-Z0-9]*/g)?.length || 0;
      userSnake += file.content.match(/[a-z]+_[a-z0-9_]+/g)?.length || 0;
    }

    const userStyle = userCamel > userSnake ? 'camelCase' : 'snake_case';
    
    // Similarity calculation
    let similarityScore = 50;
    const suggestions: string[] = [];

    if (codeStyle === userStyle) {
      similarityScore += 30;
      suggestions.push(`Naming convention aligns perfectly with your favorite style (${userStyle}).`);
    } else {
      similarityScore -= 10;
      suggestions.push(`You typically write code in ${userStyle}, but this segment uses ${codeStyle}. Consider rewriting variables names.`);
    }

    // Check error handling match: user typical catch block has logger?
    const hasCodeErrorHandling = code.includes('catch') || code.includes('try');
    if (hasCodeErrorHandling) {
      similarityScore += 10;
      suggestions.push('Includes error handling guards.');
    } else {
      suggestions.push('No active error handling blocks. Add try/catch or conditional checks to match your standard.');
    }

    return res.status(200).json({
      similarity: Math.min(100, Math.max(20, similarityScore)),
      styleMatch: codeStyle === userStyle,
      namingConvention: codeStyle,
      suggestions,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
