import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Ingresá un correo válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const registerSchema = z.object({
  email: z.string().trim().email('Ingresá un correo válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  fullName: z.string().trim().min(2, 'El nombre es obligatorio').max(100),
  role: z.enum(['business', 'creator']),
});

export const campaignSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(4000),
  category: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  budgetMin: z.coerce.number().int().min(0),
  budgetMax: z.coerce.number().int().min(0),
  deadline: z.string().optional(),
  deliverables: z.array(z.string().trim().min(1)).min(1),
}).refine(d => d.budgetMax >= d.budgetMin, {
  message: 'El presupuesto máximo debe ser mayor o igual al mínimo',
  path: ['budgetMax'],
});

export const applicationSchema = z.object({
  message: z.string().trim().min(5).max(2000),
  proposedPrice: z.coerce.number().int().min(0),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1, 'Escribí un mensaje').max(4000),
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1500).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type ApplicationInput = z.infer<typeof applicationSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
