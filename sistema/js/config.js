/** Configuração exclusiva do treinamento. Não conecta ao Firebase real. */
export const APP_CONFIG = {
  empresaId: "empresa-treinamento",
  app: {
    nome: "Ateliê Digital de Joias",
    subtitulo: "Controle profissional para joalheria, fábrica e produção",
    assinatura: "Powered by thIAguinho Soluções Digitais"
  },
  firebase: {},
  gestores: { emails: [], uids: [] },
  cloudinary: { cloudName: "", uploadPreset: "", folder: "" },
  negocio: { diasEstoqueParado: 90, estoqueMinimoPadrao: 3, percentualComissaoPadrao: 3 }
};
