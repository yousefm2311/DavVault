"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addWorkspaceMember = exports.getWorkspaceMembers = void 0;
const models_1 = require("../models");
const getWorkspaceMembers = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        // Find workspace owned by user or containing them
        const workspace = await models_1.Workspace.findOne({
            $or: [
                { ownerId: req.user.id },
                { 'members.userId': req.user.id }
            ]
        }).populate('members.userId', 'name email avatar plan');
        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found.' });
        }
        return res.status(200).json({ workspace });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getWorkspaceMembers = getWorkspaceMembers;
const addWorkspaceMember = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { email, role } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Teammate email is required.' });
        }
        // Find the workspace
        const workspace = await models_1.Workspace.findOne({ ownerId: req.user.id });
        if (!workspace) {
            return res.status(403).json({ error: 'Only workspace owners can add members.' });
        }
        // Find user to add
        const targetUser = await models_1.User.findOne({ email: email.toLowerCase().trim() });
        if (!targetUser) {
            return res.status(404).json({ error: 'No DevVault AI user found with this email.' });
        }
        // Check if already in workspace
        const isMember = workspace.members.some(m => m.userId.toString() === targetUser._id.toString());
        if (isMember) {
            return res.status(400).json({ error: 'User is already a member of this workspace.' });
        }
        // Add to members array
        workspace.members.push({
            userId: targetUser._id,
            role: role || 'member',
        });
        await workspace.save();
        return res.status(200).json({
            message: 'Teammate added to workspace successfully.',
            member: {
                userId: {
                    id: targetUser._id,
                    name: targetUser.name,
                    email: targetUser.email,
                    avatar: targetUser.avatar,
                },
                role: role || 'member',
            },
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.addWorkspaceMember = addWorkspaceMember;
