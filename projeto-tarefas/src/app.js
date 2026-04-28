import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase.js";
import {
    iniciarListenerTarefas,
    criarTarefa,
    atualizarTarefa,
    toggleEstadoTarefa,
    eliminarTarefa,
    removerAnexo
} from "./firestore.js";

/* ─── Estado ─────────────────────────────────────────────────────────── */
let todasTarefas    = [];
let filtroEstado    = "todas";
let filtroCategoria = "";
let termoPesquisa   = "";
let editandoId      = null;
let unsubscribe     = null;
let vistaAtual      = "lista";
let calAno          = new Date().getFullYear();
let calMes          = new Date().getMonth();
let currentUser     = null;

// Ficheiros pendentes no modal (ainda não guardados)
let anexosPendentes = [];   // [{ nome, tipo, tamanho, base64 }]
let anexosExistentes = [];  // cópia dos anexos da tarefa em edição

const LIMITE_FICHEIRO_BYTES = 500 * 1024; // 500 KB

/* ─── Categorias ─────────────────────────────────────────────────────── */
const CATEGORIAS = {
    trabalho: { emoji: "💼", label: "Trabalho" },
    pessoal:  { emoji: "🏠", label: "Pessoal"  },
    estudo:   { emoji: "📚", label: "Estudo"   },
    saude:    { emoji: "🏃", label: "Saúde"    },
    financas: { emoji: "💰", label: "Finanças" },
    familia:  { emoji: "👨‍👩‍👧", label: "Família"  },
    viagem:   { emoji: "✈️", label: "Viagem"   },
    outro:    { emoji: "🔖", label: "Outro"    },
};

/* ─── Auth guard ─────────────────────────────────────────────────────── */
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("index.html");
        return;
    }
    currentUser = user;
    document.getElementById("userName").textContent   = user.displayName || "Utilizador";
    document.getElementById("userEmail").textContent  = user.email;
    document.getElementById("userAvatar").textContent = (user.displayName || user.email)[0].toUpperCase();

    if (unsubscribe) unsubscribe();
    unsubscribe = iniciarListenerTarefas(user.uid, user.email, (tarefas) => {
        todasTarefas = tarefas;
        document.getElementById("loadingState")?.classList.add("hidden");
        atualizarUI();
    });
});

/* ─── Logout ─────────────────────────────────────────────────────────── */
window.logout = async function () {
    if (unsubscribe) unsubscribe();
    await signOut(auth);
    window.location.replace("index.html");
};

/* ─── Vista ──────────────────────────────────────────────────────────── */
window.setVista = function (vista, btn) {
    vistaAtual = vista;
    document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");

    const grid  = document.getElementById("tasksGrid");
    const cal   = document.getElementById("calendarioView");
    const empty = document.getElementById("emptyState");

    if (vista === "calendario") {
        grid.classList.add("hidden");
        empty.classList.add("hidden");
        cal.classList.remove("hidden");
        renderCalendario();
    } else {
        cal.classList.add("hidden");
        grid.classList.remove("hidden");
        renderTarefas(tarefasFiltradas());
    }
};

/* ─── Filtros e pesquisa ─────────────────────────────────────────────── */
window.setFiltro = function (estado, btn) {
    filtroEstado = estado;
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    const titulos = { todas: "Todas as tarefas", pendente: "Por fazer", concluida: "Concluídas" };
    document.getElementById("headerTitulo").textContent = titulos[estado] || "Tarefas";
    atualizarUI();
};

window.setCategoria = function (cat, btn) {
    filtroCategoria = cat;
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    atualizarUI();
};

window.pesquisar = function (termo) {
    termoPesquisa = termo.toLowerCase().trim();
    atualizarUI();
};

function tarefasFiltradas() {
    return todasTarefas.filter(t => {
        const passaEstado    = filtroEstado === "todas" || t.estado === filtroEstado;
        const passaCategoria = !filtroCategoria || t.categoria === filtroCategoria;
        const passaPesquisa  = !termoPesquisa ||
            t.titulo.toLowerCase().includes(termoPesquisa) ||
            (t.descricao || "").toLowerCase().includes(termoPesquisa);
        return passaEstado && passaCategoria && passaPesquisa;
    });
}

/* ─── Render ─────────────────────────────────────────────────────────── */
function atualizarUI() {
    const total      = todasTarefas.length;
    const pendentes  = todasTarefas.filter(t => t.estado === "pendente").length;
    const concluidas = todasTarefas.filter(t => t.estado === "concluida").length;

    document.getElementById("countTodas").textContent     = total;
    document.getElementById("countPendente").textContent  = pendentes;
    document.getElementById("countConcluida").textContent = concluidas;
    document.getElementById("headerSub").textContent =
        total === 0 ? "Nenhuma tarefa ainda" :
        `${pendentes} por fazer · ${concluidas} concluída${concluidas !== 1 ? "s" : ""}`;

    vistaAtual === "calendario" ? renderCalendario() : renderTarefas(tarefasFiltradas());
}

function renderTarefas(lista) {
    const grid  = document.getElementById("tasksGrid");
    const empty = document.getElementById("emptyState");
    if (!grid) return;

    if (!lista.length) {
        grid.innerHTML = "";
        empty?.classList.remove("hidden");
        return;
    }
    empty?.classList.add("hidden");
    grid.innerHTML = lista.map(t => cardHTML(t)).join("");
}

function cardHTML(t) {
    const hoje      = new Date().toISOString().slice(0, 10);
    const vencida   = t.dataLimite && t.dataLimite < hoje && t.estado !== "concluida";
    const concluida = t.estado === "concluida";
    const cat       = CATEGORIAS[t.categoria] || CATEGORIAS.outro;
    const eMinhaT   = t.uid === currentUser?.uid;

    // Badge de atribuição
    const atribuidoBadge = t.atribuidoAEmail ? `
        <span class="task-atribuido" title="Atribuída a ${escapeHtml(t.atribuidoAEmail)}">
            👤 ${escapeHtml(t.atribuidoANome || t.atribuidoAEmail)}
        </span>` : "";

    // Badge "atribuída por" (quando a tarefa é de outro utilizador)
    const atribuidaPorBadge = !eMinhaT ? `
        <span class="task-atribuido atribuida-por" title="Criada por outro utilizador">
            ↩ partilhada
        </span>` : "";

    // Anexos
    const anexosHTML = t.anexos?.length ? `
        <div class="task-anexos">
            ${t.anexos.map((a, i) => `
                <a class="anexo-chip" href="${a.base64}" download="${escapeHtml(a.nome)}" title="Descarregar ${escapeHtml(a.nome)}">
                    ${iconeAnexo(a.tipo)} ${escapeHtml(a.nome)}
                </a>
            `).join("")}
        </div>` : "";

    return `
    <div class="task-card ${concluida ? "concluida" : ""} ${!eMinhaT ? "partilhada" : ""}">
        <div class="task-card-top">
            <button class="task-check ${concluida ? "checked" : ""}"
                    onclick="toggleTarefa('${t.id}', '${t.estado}')"
                    title="${concluida ? "Marcar como por fazer" : "Marcar como concluída"}">
            </button>
            <div class="task-info">
                <div class="task-titulo">${escapeHtml(t.titulo)}</div>
                ${t.descricao ? `<div class="task-desc">${escapeHtml(t.descricao)}</div>` : ""}
            </div>
        </div>
        ${anexosHTML}
        <div class="task-footer">
            <span class="task-badge badge-${t.categoria}">${cat.emoji} ${cat.label}</span>
            ${t.prioridade !== "normal" ? `
                <span class="task-prioridade prioridade-${t.prioridade}">
                    ${t.prioridade === "alta" ? "↑ Alta" : "↓ Baixa"}
                </span>` : ""}
            ${t.dataLimite ? `
                <span class="task-data ${vencida ? "vencida" : ""}">
                    ${vencida ? "⚠ " : ""}${formatarData(t.dataLimite)}
                </span>` : ""}
            ${atribuidoBadge}
            ${atribuidaPorBadge}
        </div>
        <div class="task-actions">
            <button class="task-btn" onclick="abrirEditar('${t.id}')">Editar</button>
            ${eMinhaT ? `<button class="task-btn del" onclick="confirmarEliminar('${t.id}', \`${escapeHtml(t.titulo)}\`)">Eliminar</button>` : ""}
        </div>
    </div>`;
}

function iconeAnexo(tipo) {
    if (!tipo) return "📎";
    if (tipo.startsWith("image/"))       return "🖼";
    if (tipo === "application/pdf")      return "📄";
    if (tipo.includes("word"))           return "📝";
    if (tipo.includes("sheet") || tipo.includes("excel")) return "📊";
    if (tipo.includes("zip") || tipo.includes("rar"))     return "🗜";
    return "📎";
}

/* ─── Calendário ─────────────────────────────────────────────────────── */
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
               "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

window.navegarMes = function (delta) {
    calMes += delta;
    if (calMes > 11) { calMes = 0;  calAno++; }
    if (calMes < 0)  { calMes = 11; calAno--; }
    renderCalendario();
};

function renderCalendario() {
    const titulo = document.getElementById("calTitulo");
    const grid   = document.getElementById("calGrid");
    if (!titulo || !grid) return;

    titulo.textContent = `${MESES[calMes]} ${calAno}`;

    const lista = tarefasFiltradas().filter(t => t.dataLimite);
    const tarefasPorDia = {};
    lista.forEach(t => {
        if (!tarefasPorDia[t.dataLimite]) tarefasPorDia[t.dataLimite] = [];
        tarefasPorDia[t.dataLimite].push(t);
    });

    const primeiroDia = new Date(calAno, calMes, 1).getDay();
    const diasNoMes   = new Date(calAno, calMes + 1, 0).getDate();
    const hoje        = new Date().toISOString().slice(0, 10);

    let html = DIAS_SEMANA.map(d => `<div class="cal-dia-semana">${d}</div>`).join("");
    for (let i = 0; i < primeiroDia; i++) html += `<div class="cal-celula vazia"></div>`;

    for (let d = 1; d <= diasNoMes; d++) {
        const key     = `${calAno}-${String(calMes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const tarefas = tarefasPorDia[key] || [];
        const eHoje   = key === hoje;

        const badges = tarefas.slice(0, 3).map(t => {
            const cat = CATEGORIAS[t.categoria] || CATEGORIAS.outro;
            return `<div class="cal-tarefa badge-${t.categoria} ${t.estado === "concluida" ? "concluida" : ""}"
                         onclick="abrirEditar('${t.id}')" title="${escapeHtml(t.titulo)}">
                        ${cat.emoji} ${escapeHtml(t.titulo)}
                    </div>`;
        }).join("");

        const mais = tarefas.length > 3 ? `<div class="cal-mais">+${tarefas.length - 3} mais</div>` : "";

        html += `
        <div class="cal-celula ${eHoje ? "hoje" : ""} ${tarefas.length ? "tem-tarefas" : ""}">
            <span class="cal-num">${d}</span>
            <div class="cal-tarefas-lista">${badges}${mais}</div>
        </div>`;
    }
    grid.innerHTML = html;
}

/* ─── Modal ──────────────────────────────────────────────────────────── */
window.abrirModal = function (dataPreenchida = null) {
    editandoId = null;
    anexosPendentes  = [];
    anexosExistentes = [];
    document.getElementById("modalTitulo").textContent     = "Nova tarefa";
    document.getElementById("btnGuardarTexto").textContent = "Criar tarefa";
    limparModal();
    if (dataPreenchida) document.getElementById("fData").value = dataPreenchida;
    document.getElementById("modalOverlay").classList.remove("hidden");
    renderAnexosModal();
    setTimeout(() => document.getElementById("fTitulo")?.focus(), 100);
};

window.abrirEditar = function (id) {
    const t = todasTarefas.find(x => x.id === id);
    if (!t) return;

    editandoId       = id;
    anexosPendentes  = [];
    anexosExistentes = [...(t.anexos || [])];

    document.getElementById("modalTitulo").textContent     = "Editar tarefa";
    document.getElementById("btnGuardarTexto").textContent = "Guardar alterações";
    document.getElementById("fTitulo").value        = t.titulo || "";
    document.getElementById("fDescricao").value     = t.descricao || "";
    document.getElementById("fCategoria").value     = t.categoria || "outro";
    document.getElementById("fPrioridade").value    = t.prioridade || "normal";
    document.getElementById("fData").value          = t.dataLimite || "";
    document.getElementById("fAtribuido").value     = t.atribuidoAEmail || "";
    document.getElementById("modalFeedback").textContent = "";
    document.getElementById("modalOverlay").classList.remove("hidden");
    renderAnexosModal();
    setTimeout(() => document.getElementById("fTitulo")?.focus(), 100);
};

window.fecharModal = function () {
    document.getElementById("modalOverlay").classList.add("hidden");
    editandoId = null;
    limparModal();
};

window.fecharModalFora = function (e) {
    if (e.target === document.getElementById("modalOverlay")) window.fecharModal();
};

function limparModal() {
    ["fTitulo", "fDescricao", "fData", "fAtribuido"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    document.getElementById("fCategoria").value  = "outro";
    document.getElementById("fPrioridade").value = "normal";
    const fb = document.getElementById("modalFeedback");
    if (fb) { fb.textContent = ""; fb.className = "feedback-msg"; }
    anexosPendentes  = [];
    anexosExistentes = [];
    renderAnexosModal();
}

/* ─── Anexos no modal ────────────────────────────────────────────────── */
window.acionarInputFicheiro = function () {
    document.getElementById("fFicheiros").click();
};

window.onFicheirosEscolhidos = async function (input) {
    const fb = document.getElementById("modalFeedback");
    const ficheiros = Array.from(input.files);

    for (const f of ficheiros) {
        if (f.size > LIMITE_FICHEIRO_BYTES) {
            fb.textContent = `"${f.name}" excede o limite de 500 KB.`;
            fb.className = "feedback-msg error";
            continue;
        }
        const base64 = await lerFicheiroBase64(f);
        anexosPendentes.push({ nome: f.name, tipo: f.type, tamanho: f.size, base64 });
    }
    input.value = ""; // reset para permitir re-selecionar o mesmo ficheiro
    renderAnexosModal();
};

function lerFicheiroBase64(ficheiro) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(ficheiro);
    });
}

window.removerAnexoPendente = function (indice) {
    anexosPendentes.splice(indice, 1);
    renderAnexosModal();
};

window.removerAnexoExistente = async function (indice) {
    if (!editandoId) return;
    try {
        await removerAnexo(editandoId, anexosExistentes, indice);
        anexosExistentes.splice(indice, 1);
        renderAnexosModal();
        mostrarToast("Anexo removido.", "info");
    } catch (err) {
        console.error(err);
        mostrarToast("Erro ao remover anexo.", "error");
    }
};

function renderAnexosModal() {
    const container = document.getElementById("anexosModal");
    if (!container) return;

    const existentesHTML = anexosExistentes.map((a, i) => `
        <div class="anexo-item">
            <a href="${a.base64}" download="${escapeHtml(a.nome)}" class="anexo-nome">
                ${iconeAnexo(a.tipo)} ${escapeHtml(a.nome)}
                <span class="anexo-tamanho">${formatarTamanho(a.tamanho)}</span>
            </a>
            <button class="anexo-remover" onclick="removerAnexoExistente(${i})" title="Remover">✕</button>
        </div>`).join("");

    const pendentesHTML = anexosPendentes.map((a, i) => `
        <div class="anexo-item pendente">
            <span class="anexo-nome">
                ${iconeAnexo(a.tipo)} ${escapeHtml(a.nome)}
                <span class="anexo-tamanho">${formatarTamanho(a.tamanho)}</span>
            </span>
            <button class="anexo-remover" onclick="removerAnexoPendente(${i})" title="Remover">✕</button>
        </div>`).join("");

    container.innerHTML = existentesHTML + pendentesHTML;
}

/* ─── Guardar tarefa ─────────────────────────────────────────────────── */
window.guardarTarefa = async function () {
    const titulo         = document.getElementById("fTitulo")?.value.trim();
    const descricao      = document.getElementById("fDescricao")?.value.trim();
    const categoria      = document.getElementById("fCategoria")?.value;
    const prioridade     = document.getElementById("fPrioridade")?.value;
    const dataLimite     = document.getElementById("fData")?.value || null;
    const atribuidoEmail = document.getElementById("fAtribuido")?.value.trim().toLowerCase();
    const fb             = document.getElementById("modalFeedback");
    const btn            = document.getElementById("btnGuardar");

    if (!titulo) {
        fb.textContent = "O título é obrigatório.";
        fb.className = "feedback-msg error";
        document.getElementById("fTitulo")?.focus();
        return;
    }

    // Não pode atribuir a si próprio
    if (atribuidoEmail && atribuidoEmail === currentUser?.email?.toLowerCase()) {
        fb.textContent = "Não podes atribuir uma tarefa a ti próprio.";
        fb.className = "feedback-msg error";
        return;
    }

    btn.disabled = true;
    fb.textContent = "";
    fb.className = "feedback-msg";

    // Juntar anexos existentes (sem os removidos) + pendentes novos
    const todosAnexos = [...anexosExistentes, ...anexosPendentes];

    try {
        const uid = auth.currentUser.uid;
        const dados = {
            titulo, descricao, categoria, prioridade, dataLimite,
            atribuidoAEmail: atribuidoEmail || "",
            atribuidoANome:  atribuidoEmail || "",
            anexos: todosAnexos
        };

        if (editandoId) {
            await atualizarTarefa(editandoId, dados);
            mostrarToast("Tarefa atualizada!", "success");
        } else {
            await criarTarefa(uid, dados);
            mostrarToast("Tarefa criada!", "success");
        }
        window.fecharModal();
    } catch (err) {
        console.error(err);
        fb.textContent = "Erro ao guardar. Tenta novamente.";
        fb.className = "feedback-msg error";
    } finally {
        btn.disabled = false;
    }
};

/* ─── Ações ──────────────────────────────────────────────────────────── */
window.toggleTarefa = async function (id, estadoAtual) {
    try {
        await toggleEstadoTarefa(id, estadoAtual);
        mostrarToast(estadoAtual === "concluida" ? "Tarefa reaberta." : "Tarefa concluída! ✓", "success");
    } catch (err) {
        console.error(err);
        mostrarToast("Erro ao atualizar.", "error");
    }
};

window.confirmarEliminar = function (id, titulo) {
    if (confirm(`Eliminar "${titulo}"?\nEsta ação não pode ser desfeita.`)) {
        eliminarTarefa(id)
            .then(() => mostrarToast("Tarefa eliminada.", "info"))
            .catch(() => mostrarToast("Erro ao eliminar.", "error"));
    }
};

/* ─── Toast ──────────────────────────────────────────────────────────── */
function mostrarToast(msg, tipo = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const icons = { success: "✓", error: "✕", info: "ℹ" };
    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `<span>${icons[tipo] || "ℹ"}</span> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ─── Utilitários ────────────────────────────────────────────────────── */
function escapeHtml(text) {
    if (!text) return "";
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
}

function formatarData(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}

function formatarTamanho(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── Teclado ────────────────────────────────────────────────────────── */
document.addEventListener("keydown", e => {
    if (e.key === "Escape") window.fecharModal();
    if (e.key === "Enter" && !document.getElementById("modalOverlay").classList.contains("hidden")) {
        const active = document.activeElement?.tagName;
        if (active !== "TEXTAREA" && active !== "SELECT") window.guardarTarefa();
    }
});