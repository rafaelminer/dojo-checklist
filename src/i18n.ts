import { en as phrases } from "./phrases-en";

export type Lang = "pt" | "en";

const dict: Record<Lang, Record<string, string>> = {
  pt: {
    welcome: "Bem-vindo",
    loginSub: "Faça login para ver seu checklist",
    login: "Login",
    password: "Senha",
    enter: "Entrar",
    remember: "Lembrar de mim",
    privacy: "Política de privacidade",
    hello: "Olá",
    navChecklist: "Checklist",
    navChat: "Chat",
    navOverview: "Conferência",
    navModules: "Módulos",
    today: "Hoje",
    language: "Idioma",
  },
  en: {
    welcome: "Welcome",
    loginSub: "Sign in to see your checklist",
    login: "Login",
    password: "Password",
    enter: "Sign in",
    remember: "Remember me",
    privacy: "Privacy policy",
    hello: "Hello",
    navChecklist: "Checklist",
    navChat: "Chat",
    navOverview: "Review",
    navModules: "Modules",
    today: "Today",
    language: "Language",
  },
};

export function translate(lang: Lang, key: string) {
  return dict[lang][key] ?? (lang === "en" ? phrases[key] : undefined) ?? dict.pt[key] ?? key;
}
