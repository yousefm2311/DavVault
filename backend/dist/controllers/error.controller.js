"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteError = exports.getErrorById = exports.getErrors = exports.createErrorSolution = void 0;
const models_1 = require("../models");
const ai_service_1 = require("../services/ai.service");
const createErrorSolution = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { title, errorMessage, cause, solution, beforeCode, afterCode, projectId, tags } = req.body;
        if (!title || !errorMessage || !cause || !solution) {
            return res.status(400).json({ error: 'Title, errorMessage, cause, and solution are required.' });
        }
        const errorSolution = await models_1.ErrorSolution.create({
            userId: req.user.id,
            title,
            errorMessage,
            cause,
            solution,
            beforeCode: beforeCode || '',
            afterCode: afterCode || '',
            projectId,
            tags: tags || [],
        });
        // Generate vector embedding for semantic search
        const vector = await ai_service_1.aiService.generateEmbedding(`${title}\n${errorMessage}\n${cause}\n${solution}`);
        await models_1.Embedding.create({
            userId: req.user.id,
            projectId,
            sourceType: 'errorSolution',
            sourceId: errorSolution._id,
            content: `${title}\nError: ${errorMessage}\nSolution: ${solution}`,
            vector,
            metadata: { title },
        });
        // Log bug resolution activity
        await models_1.Activity.create({
            userId: req.user.id,
            action: `Logged bug resolution: ${title}`,
            entityType: 'error',
            entityId: errorSolution._id,
            metadata: { errorTitle: title }
        });
        return res.status(201).json({ message: 'Error solution logged successfully.', errorSolution });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.createErrorSolution = createErrorSolution;
const getErrors = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const errors = await models_1.ErrorSolution.find({ userId: req.user.id }).sort({ createdAt: -1 });
        return res.status(200).json({ errors });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getErrors = getErrors;
const getErrorById = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const error = await models_1.ErrorSolution.findOne({ _id: req.params.id, userId: req.user.id });
        if (!error)
            return res.status(404).json({ error: 'Error solution record not found.' });
        return res.status(200).json({ error });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getErrorById = getErrorById;
const deleteError = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const error = await models_1.ErrorSolution.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!error)
            return res.status(404).json({ error: 'Error solution record not found.' });
        // Clean up associated vector embedding
        await models_1.Embedding.deleteMany({ sourceId: req.params.id, sourceType: 'errorSolution' });
        return res.status(200).json({ message: 'Error solution record deleted successfully.' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.deleteError = deleteError;
