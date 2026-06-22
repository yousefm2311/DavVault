import { Schema, model, Document } from 'mongoose';

export interface IAdminSetting extends Document {
  key: string;
  value: Record<string, any>;
  updatedAt: Date;
  createdAt: Date;
}

const AdminSettingSchema = new Schema<IAdminSetting>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const AdminSetting = model<IAdminSetting>('AdminSetting', AdminSettingSchema);
