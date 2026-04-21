import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    onAuthStateChanged,
    signOut
} from "firebase/auth";
import { auth } from "./firebase.js";
 
/* ─── Redirecionar se já estiver autenticado ─────────────────────────── */
onAuthStateChanged(auth, (user) => {
    if (user) window.location.replace("app.html");
});
 
/* ─── Utilitários ────────────────────────────────────────────────────── */
function setFeedback(id, msg, tipo) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = "feedback-msg " + (tipo || "");
}
 
function traduzErro(code) {
    const erros = {
        "auth/invalid-email":          "Email inválido.",
        "auth/user-not-found":         "Utilizador não encontrado.",
        "auth/wrong-password":         "Palavra-passe incorreta.",
        "auth/invalid-credential":     "Email ou palavra-passe incorretos.",
        "auth/email-already-in-use":   "Este email já está registado.",
        "auth/weak-password":          "A palavra-passe deve ter pelo menos 6 caracteres.",
        "auth/too-many-requests":      "Muitas tentativas. Tenta mais tarde.",
        "auth/network-request-failed": "Erro de rede. Verifica a tua ligação.",
    };
    return erros[code] || "Ocorreu um erro. Tenta novamente.";
}
 
/* ─── Login ──────────────────────────────────────────────────────────── */
window.login = async function () {
    const email    = document.getElementById("loginEmail")?.value.trim();
    const password = document.getElementById("loginPassword")?.value;
    const btn      = document.getElementById("btnLogin");
 
    if (!email || !password) {
        setFeedback("loginFeedback", "Preenche todos os campos.", "error");
        return;
    }
 
    btn.disabled = true;
    btn.querySelector("span").textContent = "A entrar...";
    setFeedback("loginFeedback", "");
 
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged trata do redirect
    } catch (err) {
        console.error("Erro login:", err.code);
        setFeedback("loginFeedback", traduzErro(err.code), "error");
        btn.disabled = false;
        btn.querySelector("span").textContent = "Entrar";
    }
};
 
/* ─── Registo ────────────────────────────────────────────────────────── */
window.registar = async function () {
    const nome     = document.getElementById("registoNome")?.value.trim();
    const email    = document.getElementById("registoEmail")?.value.trim();
    const password = document.getElementById("registoPassword")?.value;
    const btn      = document.getElementById("btnRegisto");
 
    if (!nome || !email || !password) {
        setFeedback("registoFeedback", "Preenche todos os campos.", "error");
        return;
    }
    if (password.length < 6) {
        setFeedback("registoFeedback", "A palavra-passe deve ter pelo menos 6 caracteres.", "error");
        return;
    }
 
    btn.disabled = true;
    btn.querySelector("span").textContent = "A criar conta...";
    setFeedback("registoFeedback", "");
 
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: nome });
        // onAuthStateChanged trata do redirect
    } catch (err) {
        console.error("Erro registo:", err.code);
        setFeedback("registoFeedback", traduzErro(err.code), "error");
        btn.disabled = false;
        btn.querySelector("span").textContent = "Criar conta";
    }
};
 
/* ─── Logout (exportado para uso no app.js) ──────────────────────────── */
export async function logout() {
    await signOut(auth);
    window.location.replace("index.html");
}
 
/* ─── Tabs ───────────────────────────────────────────────────────────── */
window.switchTab = function (tab) {
    const isLogin = tab === "login";
    document.getElementById("tabLogin").classList.toggle("active", isLogin);
    document.getElementById("tabRegisto").classList.toggle("active", !isLogin);
    document.getElementById("formLogin").classList.toggle("hidden", !isLogin);
    document.getElementById("formRegisto").classList.toggle("hidden", isLogin);
};
 
/* ─── Enter nos campos ───────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("loginPassword")?.addEventListener("keydown", e => {
        if (e.key === "Enter") window.login();
    });
    document.getElementById("registoPassword")?.addEventListener("keydown", e => {
        if (e.key === "Enter") window.registar();
    });
});
 