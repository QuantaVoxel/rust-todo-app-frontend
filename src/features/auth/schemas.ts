import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .max(50, "Username maksimal 50 karakter"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
  first_name: z
    .string()
    .min(1, "Nama depan wajib diisi")
    .max(255, "Maksimal 255 karakter"),
  last_name: z
    .string()
    .min(1, "Nama belakang wajib diisi")
    .max(255, "Maksimal 255 karakter"),
  phone_number: z
    .string()
    .min(6, "Nomor telepon minimal 6 karakter")
    .max(20, "Nomor telepon maksimal 20 karakter"),
  avatar_url: z
    .string()
    .url("Format URL avatar tidak valid")
    .optional()
    .or(z.literal("")),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
