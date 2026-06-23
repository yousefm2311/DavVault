import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { File as DBFile, Project } from '../models';

export const getDeveloperDNA = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const userId = req.user.id;

    // Scan user's files to analyze DNA
    const files = await DBFile.find({ userId });
    const projects = await Project.find({ userId });
    
    // Default fallback values if no files/projects exist yet
    if (files.length === 0) {
      return res.status(200).json({
        favoriteStack: {
          language: 'TypeScript',
          framework: 'Next.js',
          database: 'MongoDB',
        },
        strengths: {
          backend: 70,
          frontend: 85,
          mobile: 40,
          devops: 30,
          ai: 50,
        },
        namingStyle: 'camelCase',
        stats: {
          camelCaseMatches: 0,
          snakeCaseMatches: 0,
        },
        productivityScore: 94,
        productivityGrowth: '+12%',
        technologyBreakdown: {
          cloudNative: 20,
          webEngine: 60,
          machineLearning: 15,
          legacySupport: 5,
        },
        topLanguages: [
          { name: 'TypeScript', loc: 14200, pct: 88 },
          { name: 'Rust', loc: 8100, pct: 65 },
          { name: 'Python', loc: 4400, pct: 42 },
          { name: 'Go', loc: 2900, pct: 20 },
        ],
        skillGrowthCurve: [45, 60, 55, 75, 88, 94],
        preferredPattern: {
          title: 'Event-Driven Microservices',
          description: 'Prioritizes asynchronous communication, high decoupling, and horizontal scalability via RabbitMQ or Kafka.',
        },
        stylisticIdentity: {
          title: 'Highly Modular, Strict Functional Preference',
          tags: ['Immutability First', 'TDD Practitioner', 'Zero Global State'],
        },
      });
    }

    let backendFilesCount = 0;
    let frontendFilesCount = 0;
    let mobileFilesCount = 0;
    let devOpsFilesCount = 0;

    let camelCaseCount = 0;
    let snakeCaseCount = 0;

    const languagesMap: Record<string, { loc: number; count: number }> = {};
    const frameworksMap: Record<string, number> = {};
    const databasesMap: Record<string, number> = {};

    let totalLoc = 0;

    // Analyze files
    for (const file of files) {
      const ext = file.extension.toLowerCase();
      const lang = file.language || ext.toUpperCase();
      const fileLoc = file.content ? file.content.split('\n').length : 1;
      totalLoc += fileLoc;

      // Language maps
      if (!languagesMap[lang]) {
        languagesMap[lang] = { loc: 0, count: 0 };
      }
      languagesMap[lang].loc += fileLoc;
      languagesMap[lang].count += 1;

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
      const content = file.content || '';
      const camelMatches = content.match(/[a-z]+[A-Z][a-zA-Z0-9]*/g);
      if (camelMatches) camelCaseCount += camelMatches.length;

      const snakeMatches = content.match(/[a-z]+_[a-z0-9_]+/g);
      if (snakeMatches) snakeCaseCount += snakeMatches.length;
    }

    // Get project framework and db preferences
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
    const favoriteLanguage = Object.keys(languagesMap).sort((a, b) => languagesMap[b].loc - languagesMap[a].loc)[0] || 'TypeScript';
    const favoriteFramework = Object.keys(frameworksMap).sort((a, b) => frameworksMap[b] - frameworksMap[a])[0] || 'Next.js';
    const favoriteDatabase = Object.keys(databasesMap).sort((a, b) => databasesMap[b] - databasesMap[a])[0] || 'MongoDB';

    // Dynamic Productivity score (baseline 70, increases with files and projects count)
    const productivityScore = Math.min(99, Math.max(65, 75 + Math.min(15, files.length) + Math.min(9, projects.length)));
    const productivityGrowth = `+${Math.min(25, 4 + Math.floor(files.length / 2))}%`;

    // Dynamic Technology Breakdown
    let cloudNativeLoc = 0;
    let webEngineLoc = 0;
    let mlLoc = 0;
    let legacyLoc = 0;

    for (const file of files) {
      const ext = file.extension.toLowerCase();
      const fileLoc = file.content ? file.content.split('\n').length : 1;

      if (['yml', 'yaml', 'dockerfile', 'sh', 'go', 'rs'].includes(ext)) {
        cloudNativeLoc += fileLoc;
      } else if (['js', 'ts', 'jsx', 'tsx', 'html', 'css'].includes(ext)) {
        webEngineLoc += fileLoc;
      } else if (['py', 'ipynb', 'r'].includes(ext)) {
        mlLoc += fileLoc;
      } else {
        legacyLoc += fileLoc;
      }
    }

    const totalLocSum = cloudNativeLoc + webEngineLoc + mlLoc + legacyLoc || 1;
    const cloudPct = Math.max(5, Math.round((cloudNativeLoc / totalLocSum) * 100));
    const webPct = Math.max(10, Math.round((webEngineLoc / totalLocSum) * 100));
    const mlPct = Math.max(5, Math.round((mlLoc / totalLocSum) * 100));
    const legacyPct = Math.max(0, 100 - (cloudPct + webPct + mlPct));

    // Sort languages map and create topLanguages list
    const sortedLanguages = Object.entries(languagesMap)
      .map(([name, data]) => ({
        name,
        loc: data.loc,
        pct: Math.round((data.loc / totalLocSum) * 100),
      }))
      .sort((a, b) => b.loc - a.loc)
      .slice(0, 4);

    // Skill Growth Curve (Last 6 Months: incrementing up to Productivity Score)
    const curveStep = Math.max(3, Math.floor((productivityScore - 50) / 5));
    const skillGrowthCurve = [
      Math.max(40, productivityScore - curveStep * 5),
      Math.max(45, productivityScore - curveStep * 4),
      Math.max(50, productivityScore - curveStep * 3),
      Math.max(55, productivityScore - curveStep * 2),
      Math.max(60, productivityScore - curveStep * 1),
      productivityScore,
    ];

    // Determine Preferred Pattern
    let preferredPattern = {
      title: 'Layered MVC Architecture',
      description: 'Classic decoupled architecture separating presentation, business logic, and database schemas.',
    };

    if (cloudNativeLoc > webEngineLoc && cloudNativeLoc > mlLoc) {
      preferredPattern = {
        title: 'Event-Driven Microservices',
        description: 'Prioritizes asynchronous communication, high decoupling, and horizontal scalability via RabbitMQ or Kafka.',
      };
    } else if (mlLoc > webEngineLoc && mlLoc > cloudNativeLoc) {
      preferredPattern = {
        title: 'Pipeline Architecture',
        description: 'Data-driven pipeline architecture optimizing stream throughput and model evaluation.',
      };
    } else if (webEngineLoc > cloudNativeLoc) {
      preferredPattern = {
        title: 'Serverless MVC / Jamstack',
        description: 'Focuses on edge delivery, component-based architectures, and serverless background execution.',
      };
    }

    // Determine Stylistic Identity
    const stylisticIdentity = {
      title: namingStyle === 'camelCase' ? 'Highly Modular, Strict Functional Preference' : 'Procedural & Low-Overhead Focus',
      tags: namingStyle === 'camelCase'
        ? ['Immutability First', 'TDD Practitioner', 'Zero Global State']
        : ['Stack Allocation', 'Zero Allocation', 'Performance First'],
    };

    // If there is error handling in their files, append tag
    let hasTryCatch = false;
    for (const file of files) {
      if (file.content && (file.content.includes('try') || file.content.includes('catch'))) {
        hasTryCatch = true;
        break;
      }
    }
    if (hasTryCatch) {
      stylisticIdentity.tags.push('Robust Error Handling');
    } else {
      stylisticIdentity.tags.push('Defensive Checking');
    }

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
      productivityScore,
      productivityGrowth,
      technologyBreakdown: {
        cloudNative: cloudPct,
        webEngine: webPct,
        machineLearning: mlPct,
        legacySupport: legacyPct >= 0 ? legacyPct : 0,
      },
      topLanguages: sortedLanguages,
      skillGrowthCurve,
      preferredPattern,
      stylisticIdentity,
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
