"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionById = exports.getSessions = exports.explainCodeFile = exports.handleChat = void 0;
const models_1 = require("../models");
const ai_service_1 = require("../services/ai.service");
const calculateCosineSimilarity = (vecA, vecB) => {
    if (vecA.length !== vecB.length)
        return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0)
        return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};
const handleChat = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { message, sessionId, projectId } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required.' });
        }
        const userId = req.user.id;
        // 1. Retrieve or create ChatSession
        let session;
        if (sessionId) {
            session = await models_1.ChatSession.findOne({ _id: sessionId, userId });
            if (!session) {
                return res.status(404).json({ error: 'Chat session not found.' });
            }
        }
        else {
            let title = message.substring(0, 30);
            if (message.length > 30)
                title += '...';
            session = await models_1.ChatSession.create({
                userId,
                projectId,
                title,
                messages: [],
            });
        }
        // 2. Fetch relevant context (RAG Retrieval)
        const queryEmbedding = await ai_service_1.aiService.generateEmbedding(message);
        const filter = { userId };
        if (projectId) {
            filter.projectId = projectId;
        }
        const candidates = await models_1.Embedding.find(filter);
        const scoredCandidates = [];
        for (const candidate of candidates) {
            const score = calculateCosineSimilarity(queryEmbedding, candidate.vector);
            if (score >= 0.35) {
                scoredCandidates.push({ candidate, score });
            }
        }
        // Sort and grab top 5 chunks
        const topScored = scoredCandidates
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
        // Retrieve full files details for references
        const contextChunks = [];
        const citations = [];
        for (const scored of topScored) {
            const c = scored.candidate;
            let pathStr = '';
            let fileName = '';
            if (c.sourceType === 'file') {
                const file = await models_1.File.findById(c.sourceId, 'fileName path content');
                if (file) {
                    fileName = file.fileName;
                    pathStr = file.path;
                    contextChunks.push({
                        path: file.path,
                        content: c.content,
                        score: scored.score,
                    });
                    // Add to citations
                    citations.push({
                        fileName,
                        path: pathStr,
                        code: file.content.substring(0, 2000), // first 2kb of file as code view helper
                        score: scored.score,
                    });
                }
            }
            else if (c.sourceType === 'codeEntity') {
                const file = await models_1.File.findOne({ projectId: c.projectId }, 'fileName path');
                if (file) {
                    fileName = file.fileName;
                    pathStr = file.path;
                    contextChunks.push({
                        path: file.path,
                        content: c.content,
                        score: scored.score,
                    });
                    citations.push({
                        fileName,
                        path: pathStr,
                        code: c.content, // code of the class or function
                        score: scored.score,
                    });
                }
            }
        }
        // Deduplicate citations by file path
        const uniqueCitations = citations.filter((cit, idx, self) => self.findIndex((t) => t.path === cit.path) === idx);
        // 3. Format chat history
        const history = session.messages.map((m) => ({
            role: m.sender,
            content: m.text,
        }));
        // 4. Generate answer via AI
        const answer = await ai_service_1.aiService.chatWithContext(message, history, contextChunks);
        // 5. Save user message and AI response to DB session
        session.messages.push({
            sender: 'user',
            text: message,
            createdAt: new Date(),
        });
        session.messages.push({
            sender: 'assistant',
            text: answer,
            citations: uniqueCitations.map(c => ({
                fileName: c.fileName,
                path: c.path,
                code: c.code,
                score: c.score,
            })),
            createdAt: new Date(),
        });
        await session.save();
        return res.status(200).json({
            sessionId: session._id,
            title: session.title,
            answer,
            citations: uniqueCitations,
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.handleChat = handleChat;
const explainCodeFile = async (req, res) => {
    try {
        const { code, fileName, language } = req.body;
        if (!code || !fileName) {
            return res.status(400).json({ error: 'Code content and file name are required.' });
        }
        const explanation = await ai_service_1.aiService.explainCode(fileName, code, language);
        return res.status(200).json({ explanation });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.explainCodeFile = explainCodeFile;
const getSessions = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { projectId } = req.query;
        const filter = { userId: req.user.id };
        if (projectId)
            filter.projectId = projectId;
        const sessions = await models_1.ChatSession.find(filter, 'title projectId createdAt').sort({ updatedAt: -1 });
        return res.status(200).json({ sessions });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getSessions = getSessions;
const getSessionById = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { id } = req.params;
        const session = await models_1.ChatSession.findOne({ _id: id, userId: req.user.id });
        if (!session)
            return res.status(404).json({ error: 'Chat session not found.' });
        return res.status(200).json({ session });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getSessionById = getSessionById;
