"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSnippet = exports.getSnippetById = exports.getSnippets = exports.createSnippet = void 0;
const models_1 = require("../models");
const ai_service_1 = require("../services/ai.service");
const createSnippet = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { title, code, language, explanation, tags, sourceProjectId, sourceFileId } = req.body;
        if (!title || !code || !language) {
            return res.status(400).json({ error: 'Title, code, and language are required.' });
        }
        const snippet = await models_1.Snippet.create({
            userId: req.user.id,
            title,
            code,
            language,
            explanation: explanation || '',
            tags: tags || [],
            sourceProjectId,
            sourceFileId,
        });
        // Generate and save embedding for semantic search indexing
        const vector = await ai_service_1.aiService.generateEmbedding(`${title}\n${language}\n${code}\n${explanation}`);
        await models_1.Embedding.create({
            userId: req.user.id,
            sourceType: 'snippet',
            sourceId: snippet._id,
            content: `${title}\n${code}`,
            vector,
            metadata: { title, language },
        });
        // Log snippet creation activity
        await models_1.Activity.create({
            userId: req.user.id,
            action: `Saved snippet: ${title}`,
            entityType: 'snippet',
            entityId: snippet._id,
            metadata: { snippetTitle: title }
        });
        return res.status(201).json({ message: 'Snippet saved successfully.', snippet });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.createSnippet = createSnippet;
const getSnippets = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const snippets = await models_1.Snippet.find({ userId: req.user.id }).sort({ createdAt: -1 });
        return res.status(200).json({ snippets });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getSnippets = getSnippets;
const getSnippetById = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const snippet = await models_1.Snippet.findOne({ _id: req.params.id, userId: req.user.id });
        if (!snippet)
            return res.status(404).json({ error: 'Snippet not found.' });
        return res.status(200).json({ snippet });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getSnippetById = getSnippetById;
const deleteSnippet = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const snippet = await models_1.Snippet.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!snippet)
            return res.status(404).json({ error: 'Snippet not found.' });
        // Clean up associated vector embedding
        await models_1.Embedding.deleteMany({ sourceId: req.params.id, sourceType: 'snippet' });
        return res.status(200).json({ message: 'Snippet deleted successfully.' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.deleteSnippet = deleteSnippet;
