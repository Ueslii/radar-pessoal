import { z } from "zod";

export const OportunidadesSchema = z.object({
  bolsa: z.string(),
  carga: z.string(),
  empresa: z.string(),
  encaixe: z.enum(["sim", "verificar", "nao"]),
  fonte: z.string().url(),
  formatura: z.string(),
  id: z.string(),
  link: z.string().url(),
  modalidade: z.string(),
  motivo: z.string(),
  prazo: z.string(),
  programa: z.string(),
  trilha: z.string(),
});

export type Oportunidade = z.infer<typeof OportunidadesSchema>;
export const MercadoSchema = z.object({
  dolar: z.object({
    data: z.date(),
    serie: z.array(
      z.object({
        d: z.date(),
        v: z.number(),
      }),
    ),
    tipo: z.string(),
    valor: z.number(),
    variacao: z.number(),
  }),
  fontes: z.array(z.object({
    nome: z.string(),
    url: z.string().url(),
  })),
  ibovespa: z.object({
    data: z.date(),
    nota: z.string().optional(),
    valor: z.number(),
    variacao: z.number(),
  }),
  ifix: z.object({
    data: z.date(),
    valor: z.number(),
    variacao: z.number(),
  }),
  ipca12m: z.object({
    ref: z.string(),
    valor: z.number(),
  }),
  selic: z.object({
    data: z.date(),
    valor: z.number(),
  }),
  watchlist: z.array(
    z.object({
      data: z.date(),
      nome: z.string(),
      preco: z.number(),
      ticker: z.string(),
      variacao: z.number(),
    }),
  ),
});

export type Mercado = z.infer<typeof MercadoSchema>;
