import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ErrorSolution, Embedding, Activity } from '../models';
import { aiService } from '../services/ai.service';

export const createErrorSolution = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { title, errorMessage, cause, solution, beforeCode, afterCode, projectId, tags } = req.body;

    if (!title || !errorMessage || !cause || !solution) {
      return res.status(400).json({ error: 'Title, errorMessage, cause, and solution are required.' });
    }

    const errorSolution = await ErrorSolution.create({
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
    const vector = await aiService.generateEmbedding(`${title}\n${errorMessage}\n${cause}\n${solution}`);
    await Embedding.create({
      userId: req.user.id,
      projectId,
      sourceType: 'errorSolution',
      sourceId: errorSolution._id,
      content: `${title}\nError: ${errorMessage}\nSolution: ${solution}`,
      vector,
      metadata: { title },
    });

    // Log bug resolution activity
    await Activity.create({
      userId: req.user.id,
      action: `Logged bug resolution: ${title}`,
      entityType: 'error',
      entityId: errorSolution._id,
      metadata: { errorTitle: title }
    });

    return res.status(201).json({ message: 'Error solution logged successfully.', errorSolution });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getErrors = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const errors = await ErrorSolution.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ errors });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getErrorById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const error = await ErrorSolution.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!error) return res.status(404).json({ error: 'Error solution record not found.' });
    return res.status(200).json({ error });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteError = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const error = await ErrorSolution.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    
    if (!error) return res.status(404).json({ error: 'Error solution record not found.' });

    // Clean up associated vector embedding
    await Embedding.deleteMany({ sourceId: req.params.id, sourceType: 'errorSolution' });

    return res.status(200).json({ message: 'Error solution record deleted successfully.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
