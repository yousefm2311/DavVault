import { FilterQuery, ProjectionType, Types } from 'mongoose';
import { IProject, Project, Workspace } from '../models';

export const isValidObjectIdString = (value: unknown): value is string => (
  typeof value === 'string' &&
  /^[a-fA-F0-9]{24}$/.test(value) &&
  Types.ObjectId.isValid(value)
);

export const accessibleProjectFilter = async (
  userId: string,
  projectId?: string
): Promise<FilterQuery<IProject>> => {
  const workspaces = await Workspace.find({ 'members.userId': userId }, '_id').lean();
  return {
    ...(projectId ? { _id: projectId } : {}),
    $or: [
      { userId },
      { workspaceId: { $in: workspaces.map((workspace) => workspace._id) } },
    ],
  };
};

export const findAccessibleProject = async (
  userId: string,
  projectId: string,
  projection: ProjectionType<IProject> = '_id userId name workspaceId'
) => {
  if (!isValidObjectIdString(projectId)) return null;
  return Project.findOne(await accessibleProjectFilter(userId, projectId), projection).lean();
};

export const getAccessibleProjects = async (
  userId: string,
  projection: ProjectionType<IProject> = '_id userId name workspaceId'
) => Project.find(await accessibleProjectFilter(userId), projection).lean();
