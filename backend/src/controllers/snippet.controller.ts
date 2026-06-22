import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Snippet, Embedding, Activity } from '../models';
import { aiService } from '../services/ai.service';

export const createSnippet = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { title, code, language, explanation, tags, sourceProjectId, sourceFileId } = req.body;

    if (!title || !code || !language) {
      return res.status(400).json({ error: 'Title, code, and language are required.' });
    }

    const snippet = await Snippet.create({
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
    const vector = await aiService.generateEmbedding(`${title}\n${language}\n${code}\n${explanation}`);
    await Embedding.create({
      userId: req.user.id,
      sourceType: 'snippet',
      sourceId: snippet._id,
      content: `${title}\n${code}`,
      vector,
      metadata: { title, language },
    });

    // Log snippet creation activity
    await Activity.create({
      userId: req.user.id,
      action: `Saved snippet: ${title}`,
      entityType: 'snippet',
      entityId: snippet._id,
      metadata: { snippetTitle: title }
    });

    return res.status(201).json({ message: 'Snippet saved successfully.', snippet });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getSnippets = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const snippets = await Snippet.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ snippets });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getSnippetById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const snippet = await Snippet.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!snippet) return res.status(404).json({ error: 'Snippet not found.' });
    return res.status(200).json({ snippet });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteSnippet = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const snippet = await Snippet.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    
    if (!snippet) return res.status(404).json({ error: 'Snippet not found.' });

    // Clean up associated vector embedding
    await Embedding.deleteMany({ sourceId: req.params.id, sourceType: 'snippet' });

    return res.status(200).json({ message: 'Snippet deleted successfully.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
