import {
    collection, addDoc, updateDoc, deleteDoc,
    doc, query, where, orderBy, onSnapshot, serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase.js";
 
/**
 * Subscreve às tarefas do utilizador em tempo real.
 * Chama o callback sempre que houver alterações.
 * Retorna a função de cancelamento (unsubscribe).
 */
export function iniciarListenerTarefas(uid, callback) {
    const q = query(
        collection(db, "tarefas"),
        where("uid", "==", uid),
        orderBy("criadoEm", "desc")
    );
 
    return onSnapshot(q, (snapshot) => {
        const tarefas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(tarefas);
    });
}
 
/**
 * Cria uma nova tarefa para o utilizador autenticado.
 */
export async function criarTarefa(uid, dados) {
    await addDoc(collection(db, "tarefas"), {
        uid,
        titulo:     dados.titulo,
        descricao:  dados.descricao  || "",
        categoria:  dados.categoria  || "outro",
        prioridade: dados.prioridade || "normal",
        dataLimite: dados.dataLimite || null,
        estado:     "pendente",
        criadoEm:   serverTimestamp()
    });
}
 
/**
 * Atualiza campos de uma tarefa existente.
 */
export async function atualizarTarefa(id, dados) {
    await updateDoc(doc(db, "tarefas", id), dados);
}
 
/**
 * Alterna o estado de uma tarefa entre 'pendente' e 'concluida'.
 */
export async function toggleEstadoTarefa(id, estadoAtual) {
    const novo = estadoAtual === "concluida" ? "pendente" : "concluida";
    await updateDoc(doc(db, "tarefas", id), { estado: novo });
}
 
/**
 * Elimina uma tarefa permanentemente.
 */
export async function eliminarTarefa(id) {
    await deleteDoc(doc(db, "tarefas", id));
}