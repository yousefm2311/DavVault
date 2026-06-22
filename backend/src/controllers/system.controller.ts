import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ReusableSystem } from '../models';

export const createSystem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { name, description, type, relatedFiles, setupSteps, dependencies, flow, tags } = req.body;

    if (!name || !description || !type) {
      return res.status(400).json({ error: 'Name, description, and type are required.' });
    }

    const system = await ReusableSystem.create({
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getSystems = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const systems = await ReusableSystem.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ systems });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getSystemById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const system = await ReusableSystem.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!system) return res.status(404).json({ error: 'Reusable system template not found.' });
    return res.status(200).json({ system });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteSystem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const system = await ReusableSystem.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    
    if (!system) return res.status(404).json({ error: 'Reusable system template not found.' });
    return res.status(200).json({ message: 'Reusable system template deleted successfully.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
