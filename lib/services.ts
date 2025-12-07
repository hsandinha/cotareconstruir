import { db } from "./firebase";
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc } from "firebase/firestore";

// --- Types ---

export interface AuditLog {
    userId: string;
    action: string;
    details: string;
    timestamp: any;
    ip?: string; // Optional, would need a way to capture this server-side or via headers
}

export interface Report {
    reporterId: string;
    reportedId: string; // User or Content ID
    type: "user" | "content" | "chat";
    reason: string;
    description: string;
    status: "pending" | "resolved" | "dismissed";
    timestamp: any;
}

export interface Review {
    reviewerId: string;
    targetId: string; // Supplier ID
    orderId?: string;
    rating: number; // 1-5
    comment: string;
    timestamp: any;
}

// --- Functions ---

/**
 * Logs a critical action to the 'audit_logs' collection.
 */
export const logAction = async (userId: string, action: string, details: string) => {
    try {
        await addDoc(collection(db, "audit_logs"), {
            userId,
            action,
            details,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to log action:", error);
    }
};

/**
 * Creates a report against a user or content.
 */
export const createReport = async (reporterId: string, reportedId: string, type: "user" | "content" | "chat", reason: string, description: string) => {
    try {
        await addDoc(collection(db, "reports"), {
            reporterId,
            reportedId,
            type,
            reason,
            description,
            status: "pending",
            timestamp: serverTimestamp()
        });
        await logAction(reporterId, "CREATE_REPORT", `Reported ${type} ${reportedId}: ${reason}`);
    } catch (error) {
        console.error("Failed to create report:", error);
        throw error;
    }
};

/**
 * Adds a review for a supplier and updates their average rating.
 */
export const addReview = async (reviewerId: string, targetId: string, rating: number, comment: string, orderId?: string) => {
    try {
        // 1. Add the review document
        await addDoc(collection(db, "reviews"), {
            reviewerId,
            targetId,
            orderId,
            rating,
            comment,
            timestamp: serverTimestamp()
        });

        // 2. Update the supplier's average rating
        // Note: In a real high-traffic app, this should be a Cloud Function or aggregated periodically.
        // For now, we'll do a simple read-update.
        const userRef = doc(db, "users", targetId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            const currentRating = userData.rating || 0;
            const currentCount = userData.reviewCount || 0;

            const newCount = currentCount + 1;
            const newRating = ((currentRating * currentCount) + rating) / newCount;

            await updateDoc(userRef, {
                rating: newRating,
                reviewCount: newCount
            });
        }

        await logAction(reviewerId, "ADD_REVIEW", `Reviewed user ${targetId} with ${rating} stars`);

    } catch (error) {
        console.error("Failed to add review:", error);
        throw error;
    }
};

/**
 * Submits a document for verification.
 */
export const submitDocument = async (userId: string, docType: string, fileUrl: string) => {
    try {
        await addDoc(collection(db, "verifications"), {
            userId,
            docType,
            fileUrl,
            status: "pending",
            timestamp: serverTimestamp()
        });

        await updateDoc(doc(db, "users", userId), {
            verificationStatus: "pending"
        });

        await logAction(userId, "SUBMIT_DOC", `Submitted ${docType} for verification`);
    } catch (error) {
        console.error("Failed to submit document:", error);
        throw error;
    }
};
