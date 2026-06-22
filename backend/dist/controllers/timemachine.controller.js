"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimeMachineTimeline = void 0;
const mongoose_1 = require("mongoose");
const models_1 = require("../models");
const getTimeMachineTimeline = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const userId = req.user.id;
        const userObjectId = new mongoose_1.Types.ObjectId(userId);
        const monthStr = req.query.month;
        const yearStr = req.query.year;
        if (!monthStr || !yearStr) {
            return res.status(400).json({ error: 'Month and Year parameters are required.' });
        }
        const month = parseInt(monthStr, 10);
        const year = parseInt(yearStr, 10);
        if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
            return res.status(400).json({ error: 'Invalid month or year parameters.' });
        }
        // Set date ranges
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999); // last day of that month
        // Fetch primary knowledge artifacts within range.
        const [projects, snippets, errors, systems, rawActivities] = await Promise.all([
            models_1.Project.find({ userId, createdAt: { $gte: startDate, $lte: endDate } })
                .select('name description language framework database architectureType healthScore createdAt')
                .sort({ createdAt: -1 })
                .lean(),
            models_1.Snippet.find({ userId, createdAt: { $gte: startDate, $lte: endDate } })
                .select('title explanation language tags code sourceProjectId sourceFileId createdAt')
                .sort({ createdAt: -1 })
                .lean(),
            models_1.ErrorSolution.find({ userId, createdAt: { $gte: startDate, $lte: endDate } })
                .select('title errorMessage cause solution beforeCode afterCode projectId tags createdAt')
                .sort({ createdAt: -1 })
                .lean(),
            models_1.ReusableSystem.find({ userId, createdAt: { $gte: startDate, $lte: endDate } })
                .select('name description type relatedFiles setupSteps dependencies tags createdAt')
                .sort({ createdAt: -1 })
                .lean(),
            models_1.Activity.find({ userId, createdAt: { $gte: startDate, $lte: endDate } })
                .select('action entityType entityId metadata createdAt')
                .sort({ createdAt: -1 })
                .limit(200)
                .lean(),
        ]);
        const projectIds = projects.map((project) => project._id);
        const projectFileStats = await models_1.File.aggregate([
            { $match: { userId: userObjectId, projectId: { $in: projectIds } } },
            {
                $group: {
                    _id: '$projectId',
                    filesCount: { $sum: 1 },
                    storageBytes: { $sum: '$size' },
                    languages: { $addToSet: '$language' },
                },
            },
        ]);
        const fileStatsByProject = new Map(projectFileStats.map((entry) => [
            entry._id.toString(),
            {
                filesCount: entry.filesCount || 0,
                storageBytes: entry.storageBytes || 0,
                languages: (entry.languages || []).filter(Boolean),
            },
        ]));
        const timelineEvents = [];
        projects.forEach(p => {
            timelineEvents.push({
                type: 'project',
                id: p._id,
                name: p.name,
                description: p.description || 'Project imported',
                date: p.createdAt,
                action: 'project_imported',
                importance: p.healthScore >= 90 ? 'high' : p.healthScore >= 70 ? 'medium' : 'low',
                details: {
                    language: p.language || 'Generic',
                    framework: p.framework || 'Vanilla',
                    database: p.database || 'None',
                    architectureType: p.architectureType || 'Codebase',
                    healthScore: p.healthScore,
                    filesCount: fileStatsByProject.get(p._id.toString())?.filesCount || 0,
                    storageBytes: fileStatsByProject.get(p._id.toString())?.storageBytes || 0,
                    languages: fileStatsByProject.get(p._id.toString())?.languages || [],
                    link: `/projects/${p._id}`,
                },
            });
        });
        snippets.forEach(s => {
            timelineEvents.push({
                type: 'snippet',
                id: s._id,
                name: s.title,
                description: s.explanation || `Saved reusable snippet in ${s.language}`,
                date: s.createdAt,
                action: 'snippet_saved',
                importance: s.tags?.length ? 'medium' : 'low',
                details: {
                    language: s.language,
                    tags: s.tags || [],
                    codeLength: s.code?.length || 0,
                    sourceProjectId: s.sourceProjectId,
                    link: `/snippets?id=${s._id}`,
                },
            });
        });
        errors.forEach(err => {
            timelineEvents.push({
                type: 'error',
                id: err._id,
                name: err.title,
                description: `Resolved bug: ${err.errorMessage.substring(0, 140)}`,
                date: err.createdAt,
                action: 'error_resolved',
                importance: 'high',
                details: {
                    cause: err.cause,
                    solutionPreview: err.solution?.substring(0, 220),
                    tags: err.tags || [],
                    projectId: err.projectId,
                    beforeLength: err.beforeCode?.length || 0,
                    afterLength: err.afterCode?.length || 0,
                    link: `/errors?id=${err._id}`,
                },
            });
        });
        systems.forEach(system => {
            timelineEvents.push({
                type: 'system',
                id: system._id,
                name: system.name,
                description: system.description,
                date: system.createdAt,
                action: 'system_created',
                importance: 'medium',
                details: {
                    type: system.type,
                    tags: system.tags || [],
                    relatedFiles: system.relatedFiles || [],
                    dependencies: system.dependencies || [],
                    setupStepsCount: system.setupSteps?.length || 0,
                    link: `/systems?id=${system._id}`,
                },
            });
        });
        rawActivities.forEach(activity => {
            const entityId = activity.entityId?.toString();
            const duplicate = entityId && timelineEvents.some(event => event.id?.toString() === entityId && event.type === activity.entityType);
            if (duplicate)
                return;
            timelineEvents.push({
                type: activity.entityType,
                id: activity.entityId,
                name: activity.metadata?.name || activity.action.replace(/_/g, ' '),
                description: activity.metadata?.description || `Activity: ${activity.action}`,
                date: activity.createdAt,
                action: activity.action,
                importance: 'low',
                details: {
                    ...activity.metadata,
                },
            });
        });
        // Sort chronologically
        timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
        const summary = timelineEvents.reduce((acc, event) => {
            acc.total += 1;
            acc.byType[event.type] = (acc.byType[event.type] || 0) + 1;
            acc.byDay[event.date.toISOString().slice(0, 10)] = (acc.byDay[event.date.toISOString().slice(0, 10)] || 0) + 1;
            if (event.importance === 'high')
                acc.highImpact += 1;
            return acc;
        }, { total: 0, highImpact: 0, byType: {}, byDay: {} });
        const dayGroups = Object.entries(timelineEvents.reduce((acc, event) => {
            const key = event.date.toISOString().slice(0, 10);
            acc[key] = acc[key] || [];
            acc[key].push(event);
            return acc;
        }, {})).map(([date, events]) => ({
            date,
            count: events.length,
            types: events.reduce((acc, event) => {
                acc[event.type] = (acc[event.type] || 0) + 1;
                return acc;
            }, {}),
            events,
        }));
        return res.status(200).json({
            startDate,
            endDate,
            summary,
            dayGroups,
            events: timelineEvents,
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getTimeMachineTimeline = getTimeMachineTimeline;
