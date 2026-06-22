"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSystem = exports.getSystemById = exports.getSystems = exports.createSystem = void 0;
const models_1 = require("../models");
const createSystem = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { name, description, type, relatedFiles, setupSteps, dependencies, flow, tags } = req.body;
        if (!name || !description || !type) {
            return res.status(400).json({ error: 'Name, description, and type are required.' });
        }
        const system = await models_1.ReusableSystem.create({
            userId: req.user.id,
            name,
            description,
            type,
            relatedFiles: relatedFiles || [],
            setupSteps: setupSteps || [],
            dependencies: dependencies || [],
            flow: flow || '',
            tags: tags || [],
        });
        return res.status(201).json({ message: 'Reusable System template created successfully.', system });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.createSystem = createSystem;
const getSystems = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const systems = await models_1.ReusableSystem.find({ userId: req.user.id }).sort({ createdAt: -1 });
        return res.status(200).json({ systems });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getSystems = getSystems;
const getSystemById = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const system = await models_1.ReusableSystem.findOne({ _id: req.params.id, userId: req.user.id });
        if (!system)
            return res.status(404).json({ error: 'Reusable system template not found.' });
        return res.status(200).json({ system });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getSystemById = getSystemById;
const deleteSystem = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const system = await models_1.ReusableSystem.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!system)
            return res.status(404).json({ error: 'Reusable system template not found.' });
        return res.status(200).json({ message: 'Reusable system template deleted successfully.' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.deleteSystem = deleteSystem;
