/**
 * Sistema centralizado de tratamento de erros
 */

export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public isOperational: boolean = true
    ) {
        super(message);
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(400, message);
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Não autenticado') {
        super(401, message);
    }
}

export class AuthorizationError extends AppError {
    constructor(message: string = 'Não autorizado') {
        super(403, message);
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = 'Recurso não encontrado') {
        super(404, message);
    }
}

export class RateLimitError extends AppError {
    constructor(message: string = 'Muitas requisições. Tente novamente mais tarde.') {
        super(429, message);
    }
}

export class DatabaseError extends AppError {
    constructor(message: string = 'Erro no banco de dados') {
        super(500, message, false);
    }
}

/**
 * Formata erro para resposta JSON
 */
export function formatErrorResponse(error: any) {
    if (error instanceof AppError) {
        return {
            error: {
                message: error.message,
                statusCode: error.statusCode,
            },
        };
    }

    // Erros do Supabase
    if (error.code) {
        return {
            error: {
                message: getSupabaseErrorMessage(error.code, error.message),
                statusCode: getSupabaseErrorStatus(error.code),
                code: error.code,
            },
        };
    }

    // Erro genérico
    console.error('Unexpected error:', error);
    return {
        error: {
            message: 'Erro interno do servidor',
            statusCode: 500,
        },
    };
}

/**
 * Traduz códigos de erro do Supabase para mensagens amigáveis
 */
function getSupabaseErrorMessage(code: string, originalMessage?: string): string {
    const messages: Record<string, string> = {
        // Auth errors
        'invalid_credentials': 'Email ou senha incorretos',
        'user_not_found': 'Usuário não encontrado',
        'invalid_grant': 'Email ou senha incorretos',
        'email_not_confirmed': 'Por favor, confirme seu email',
        'user_already_exists': 'Este email já está em uso',
        'weak_password': 'Senha muito fraca',
        'over_request_rate_limit': 'Muitas tentativas. Tente novamente mais tarde',
        'email_exists': 'Este email já está em uso',
        'validation_failed': 'Dados inválidos',

        // Database errors
        'PGRST116': 'Nenhum registro encontrado',
        '23505': 'Este registro já existe',
        '23503': 'Operação não permitida - registro referenciado',
        '42501': 'Permissão negada',

        // JWT/Session errors
        'invalid_token': 'Sessão expirada. Faça login novamente',
        'token_expired': 'Sessão expirada. Faça login novamente',
        'refresh_token_not_found': 'Sessão inválida. Faça login novamente',
    };

    return messages[code] || originalMessage || 'Ocorreu um erro. Tente novamente.';
}

/**
 * Retorna status HTTP apropriado para erros do Supabase
 */
function getSupabaseErrorStatus(code: string): number {
    const statusMap: Record<string, number> = {
        // Auth errors
        'invalid_credentials': 401,
        'user_not_found': 404,
        'invalid_grant': 401,
        'email_not_confirmed': 403,
        'user_already_exists': 409,
        'weak_password': 400,
        'over_request_rate_limit': 429,
        'email_exists': 409,
        'validation_failed': 400,

        // Database errors
        'PGRST116': 404,
        '23505': 409,
        '23503': 400,
        '42501': 403,

        // JWT/Session errors
        'invalid_token': 401,
        'token_expired': 401,
        'refresh_token_not_found': 401,
    };

    return statusMap[code] || 500;
}

/**
 * Logger de erros (em produção, integrar com Sentry ou similar)
 */
export function logError(error: any, context?: Record<string, any>) {
    const errorLog = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        context,
    };

    if (process.env.NODE_ENV === 'production') {
        // TODO: Integrar com Sentry ou outro serviço de error tracking
        console.error('Production Error:', errorLog);
    } else {
        console.error('Development Error:', errorLog);
    }
}
