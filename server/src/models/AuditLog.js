import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    summary: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    performedByName: { type: String, required: true },
    performedByRole: { type: String, required: true },
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
