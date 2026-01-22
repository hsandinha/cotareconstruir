import { supabase } from "./supabase";

// --- Types ---

export interface AuditLog {
    userId: string;
    action: string;
    details: string;
    timestamp?: string;
    ip?: string;
}

export interface Report {
    reporterId: string;
    reportedId: string;
    type: "user" | "content" | "chat";
    reason: string;
    description: string;
    status: "pending" | "resolved" | "dismissed";
    timestamp?: string;
}

export interface Review {
    reviewerId: string;
    targetId: string; // Fornecedor ID
    orderId?: string;
    rating: number; // 1-5
    comment: string;
    timestamp?: string;
}

// --- Functions ---

/**
 * Logs a critical action to the 'audit_logs' table.
 */
export const logAction = async (userId: string, action: string, details: string) => {
    try {
        await supabase.from("audit_logs").insert({
            user_id: userId,
            action,
            details: { message: details },
        });
    } catch (error) {
        console.error("Failed to log action:", error);
    }
};

/**
 * Creates a report against a user or content.
 * Note: Uses 'reports' table in Supabase
 */
export const createReport = async (
    reporterId: string,
    reportedId: string,
    type: "user" | "content" | "chat",
    reason: string,
    description: string
) => {
    try {
        const { error } = await supabase.from("reports").insert({
            reporter_id: reporterId,
            reported_id: reportedId,
            type,
            reason,
            description,
            status: "pending",
        });

        if (error) throw error;

        await logAction(reporterId, "CREATE_REPORT", `Reported ${type} ${reportedId}: ${reason}`);
    } catch (error) {
        console.error("Failed to create report:", error);
        throw error;
    }
};

/**
 * Adds a review for a supplier and updates their average rating.
 * The trigger 'trigger_update_fornecedor_rating' handles rating recalculation automatically.
 */
export const addReview = async (
    reviewerId: string,
    targetId: string,
    rating: number,
    comment: string,
    orderId?: string
) => {
    try {
        // Get fornecedor_id from targetId (which could be user_id)
        let fornecedorId = targetId;

        const { data: fornecedorCheck } = await supabase
            .from("fornecedores")
            .select("id")
            .eq("id", targetId)
            .single();

        if (!fornecedorCheck) {
            // targetId might be a user_id, find the fornecedor
            const { data: userFornecedor } = await supabase
                .from("fornecedores")
                .select("id")
                .eq("user_id", targetId)
                .single();

            if (userFornecedor) {
                fornecedorId = userFornecedor.id;
            }
        }

        // Add the review to avaliacoes table
        const { error } = await supabase.from("avaliacoes").insert({
            avaliador_id: reviewerId,
            fornecedor_id: fornecedorId,
            pedido_id: orderId || null,
            rating,
            comentario: comment,
        });

        if (error) throw error;

        // The trigger 'trigger_update_fornecedor_rating' automatically updates
        // the fornecedor's rating and review_count

        await logAction(reviewerId, "ADD_REVIEW", `Reviewed fornecedor ${fornecedorId} with ${rating} stars`);
    } catch (error) {
        console.error("Failed to add review:", error);
        throw error;
    }
};

/**
 * Submits a document for verification.
 * Note: Uses 'verifications' table in Supabase
 */
export const submitDocument = async (userId: string, docType: string, fileUrl: string) => {
    try {
        const { error: verificationError } = await supabase.from("verifications").insert({
            user_id: userId,
            doc_type: docType,
            file_url: fileUrl,
            status: "pending",
        });

        if (verificationError) throw verificationError;

        // Update user verification status
        const { error: userError } = await supabase
            .from("users")
            .update({ is_verified: false })
            .eq("id", userId);

        if (userError) throw userError;

        await logAction(userId, "SUBMIT_DOC", `Submitted ${docType} for verification`);
    } catch (error) {
        console.error("Failed to submit document:", error);
        throw error;
    }
};
