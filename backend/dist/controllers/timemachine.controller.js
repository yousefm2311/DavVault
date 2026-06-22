"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimeMachineTimeline = void 0;
const models_1 = require("../models");
const getTimeMachineTimeline = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const userId = req.user.id;
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
        // Fetch projects, snippets and errors within range
        const [projects, snippets, errors] = await Promise.all([
            models_1.Project.find({ userId, createdAt: { $gte: startDate, $lte: endDate } }),
            models_1.Snippet.find({ userId, createdAt: { $gte: startDate, $lte: endDate } }),
            models_1.ErrorSolution.find({ userId, createdAt: { $gte: startDate, $lte: endDate } }),
        ]);
        const timelineEvents = [];
        projects.forEach(p => {
            timelineEvents.push({
                type: 'project',
                id: p._id,
                name: p.name,
                description: p.description || 'Project imported',
                date: p.createdAt,
            });
        });
        snippets.forEach(s => {
            timelineEvents.push({
                type: 'snippet',
                id: s._id,
                name: s.title,
                description: `Saved reusable snippet in ${s.language}`,
                date: s.createdAt,
            });
        });
        errors.forEach(err => {
            timelineEvents.push({
                type: 'error',
                id: err._id,
                name: err.title,
                description: `Resolved bug: ${err.errorMessage.substring(0, 80)}`,
                date: err.createdAt,
            });
        });
        // Sort chronologically
        timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
        return res.status(200).json({
            startDate,
            endDate,
            events: timelineEvents,
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getTimeMachineTimeline = getTimeMachineTimeline;
