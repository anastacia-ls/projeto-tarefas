import {
    collection, addDoc, updateDoc, deleteDoc,
    doc, query, where, orderBy, onSnapshot, serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase.js";

/* ─── Listener de tarefas (próprias + atribuídas) ────────────────────── */

/**
 * Subscreve em tempo real às tarefas do utilizador:
 * - tarefas criadas por ele (uid == uid)
 * - tarefas atribuídas a ele (atribuidoAEmail == email)
 * Junta e devolve as duas listas sem duplicados, ordenadas por data.
 */
export function iniciarListenerTarefas(uid, email, callback) {
    let tarefasProprias   = [];
    let tarefasAtribuidas = [];

    const emitir = () => {
        const ids  = new Set(tarefasProprias.map(t => t.id));
        const todas = [
            ...tarefasProprias,
            ...tarefasAtribuidas.filter(t => !ids.has(t.id))
        ];
        todas.sort((a, b) => {
            const ta = a.criadoEm?.seconds ?? 0;
            const tb = b.criadoEm?.seconds ?? 0;
            return tb - ta;
        });
        callback(todas);
    };

    const q1 = query(
        collection(db, "tarefas"),
        where("uid", "==", uid),
        orderBy("criadoEm", "desc")
    );

    const q2 = query(
        collection(db, "tarefas"),
        where("atribuidoAEmail", "==", email),
        orderBy("criadoEm", "desc")
    );

    const unsub1 = onSnapshot(q1, snap => {
        tarefasProprias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        emitir();
    });

    const unsub2 = onSnapshot(q2, snap => {
        tarefasAtribuidas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        emitir();
    });

    return () => { unsub1(); unsub2(); };
}

/* ─── CRUD ───────────────────────────────────────────────────────────── */

export async function criarTarefa(uid, dados) {
    await addDoc(collection(db, "tarefas"), {
        uid,
        titulo:          dados.titulo,
        descricao:       dados.descricao       || "",
        categoria:       dados.categoria       || "outro",
        prioridade:      dados.prioridade      || "normal",
        dataLimite:      dados.dataLimite      || null,
        estado:          "pendente",
        atribuidoAEmail: dados.atribuidoAEmail || "",
        atribuidoANome:  dados.atribuidoANome  || "",
        anexos:          dados.anexos          || [],
        criadoEm:        serverTimestamp()
    });
}

export async function atualizarTarefa(id, dados) {
    await updateDoc(doc(db, "tarefas", id), dados);
}

export async function toggleEstadoTarefa(id, estadoAtual) {
    const novo = estadoAtual === "concluida" ? "pendente" : "concluida";
    await updateDoc(doc(db, "tarefas", id), { estado: novo });
}

export async function eliminarTarefa(id) {
    await deleteDoc(doc(db, "tarefas", id));
}

export async function removerAnexo(tarefaId, anexos, indice) {
    const novosAnexos = anexos.filter((_, i) => i !== indice);
    await updateDoc(doc(db, "tarefas", tarefaId), { anexos: novosAnexos });
}