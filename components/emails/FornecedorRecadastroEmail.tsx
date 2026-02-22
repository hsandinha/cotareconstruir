import React from "react";

export type FornecedorRecadastroEmailProps = {
    logoUrl?: string;
    recipientEmail?: string;
    temporaryPassword?: string;
};

export function FornecedorRecadastroEmail({ logoUrl, recipientEmail, temporaryPassword }: FornecedorRecadastroEmailProps) {
    return (
        <html lang="pt-BR">
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Recadastramento de Fornecedores</title>
            </head>
            <body style={{ margin: 0, padding: 0, backgroundColor: "#f3f4f6" }}>
                <div style={{ width: "100%", padding: "24px 12px" }}>
                    <div
                        style={{
                            maxWidth: 720,
                            margin: "0 auto",
                            backgroundColor: "#ffffff",
                            borderRadius: 12,
                            overflow: "hidden",
                            border: "1px solid #e5e7eb",
                        }}
                    >
                        <div style={{ padding: 28, textAlign: "center" }}>
                            {logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={logoUrl}
                                    alt="Comprar & Construir"
                                    style={{ height: 52, width: "auto", display: "inline-block" }}
                                />
                            ) : (
                                <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                                    Comprar&CONSTRUIR
                                </div>
                            )}
                        </div>

                        <div style={{ padding: "0 28px 28px 28px", color: "#111827", fontFamily: "Arial, sans-serif" }}>
                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                <strong>Prezados parceiros fornecedores,</strong>
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                A Comprar e Construir resolveu transformar sua experiência de 38 anos de atendimento a milhares de
                                clientes em uma Plataforma de compras de materiais para construção civil.
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                O nosso objetivo é agilizar o processo de compras e estender a um número maior de empresas
                                construtoras, engenheiros e arquitetos autônomos e consumidores finais que buscam empresas
                                especializadas no fornecimento dos diversos materiais e equipamentos da construção civil.
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                Dessa forma, estamos recadastrando todos os fornecedores que fazem parte do nosso banco de dados,
                                já que foram nossos parceiros ao longo desses anos, nada mais justo prestigiá-los, nesta nova fase
                                da empresa.
                            </p>

                            <p style={{ margin: "0 0 12px 0", fontSize: 14, lineHeight: "22px" }}>
                                Para acessar o sistema e realizar o recadastramento, utilize o link abaixo:
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                <a
                                    href="https://comprareconstruir.com/login"
                                    style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 700 }}
                                >
                                    https://comprareconstruir.com/login
                                </a>
                            </p>

                            {(recipientEmail || temporaryPassword) && (
                                <div
                                    style={{
                                        margin: "10px 0 16px 0",
                                        padding: 14,
                                        borderRadius: 10,
                                        backgroundColor: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                        fontSize: 14,
                                        lineHeight: "22px",
                                    }}
                                >
                                    <p style={{ margin: "0 0 8px 0", fontWeight: 700 }}>Credenciais de acesso:</p>
                                    {recipientEmail && (
                                        <p style={{ margin: 0 }}>
                                            <strong>Usuário:</strong> {recipientEmail}
                                        </p>
                                    )}
                                    {temporaryPassword && (
                                        <p style={{ margin: 0 }}>
                                            <strong>Senha temporária:</strong> {temporaryPassword}
                                        </p>
                                    )}
                                    <p style={{ margin: "8px 0 0 0", color: "#475569", fontSize: 12, lineHeight: "18px" }}>
                                        No primeiro acesso, será obrigatório trocar a senha.
                                    </p>
                                </div>
                            )}

                            <p
                                style={{
                                    margin: "16px 0 14px 0",
                                    fontSize: 13,
                                    lineHeight: "20px",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                }}
                            >
                                IMPORTANTE: NO CADASTRO DE MATERIAIS SERÁ NECESSÁRIO APENAS INSERIR A DESCRIÇÃO PRINCIPAL DE
                                CADA GRUPO DE MATERIAIS, CONFORME EXEMPLO NO FORMULÁRIO.
                            </p>

                            <p
                                style={{
                                    margin: "0 0 14px 0",
                                    fontSize: 13,
                                    lineHeight: "20px",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                }}
                            >
                                ESTE CADASTRO DE MATERIAIS FICARÁ NO NOSSO BANCO DE DADOS PARA DIRECIONAR AS CONSULTAS DOS
                                NOSSOS CLIENTES ATRAVÉS DE UM LINK QUE SERÁ ENVIADO PELO E-MAIL DA Comprar E CONSTRUIR PARA OS
                                FORNECEDORES ESPECIALIZADOS QUE COMERCIALIZAM ESSES MATERIAIS. GERANDO ASSIM, MAIS OPORTUNIDADE
                                DE VENDAS DE TODA A LINHA DE MATERIAIS.
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                Caso haja alguma dúvida não hesite em nos contatar, estaremos à disposição para atendê-los.
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                Desde já agradeço a atenção de todos.
                            </p>

                            <div style={{ marginTop: 18, fontSize: 14, lineHeight: "22px" }}>
                                <p style={{ margin: "0 0 10px 0" }}>Att.</p>
                                <p style={{ margin: 0 }}>Leonardo Lopes Nogueira.</p>
                                <p style={{ margin: 0 }}>Diretor Comercial</p>
                                <p style={{ margin: 0 }}>(31) 99219-4237</p>
                            </div>

                            <p style={{ margin: "18px 0 0 0", fontSize: 14, lineHeight: "22px", fontWeight: 700 }}>
                                Favor confirmar o recebimento deste e-mail!
                            </p>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}

export function getFornecedorRecadastroEmailText() {
    return [
        "Prezados parceiros fornecedores,",
        "",
        "A Comprar e Construir resolveu transformar sua experiência de 34 anos de atendimento a",
        "milhares de clientes em uma Plataforma de compras de materiais para construção civil.",
        "",
        "O nosso objetivo é agilizar o processo de compras e estender a um número maior de empresas",
        "construtoras, engenheiros e arquitetos autônomos e consumidores finais que buscam",
        "empresas especializadas no fornecimento dos diversos materiais e equipamentos da",
        "construção civil.",
        "",
        "Dessa forma, estamos recadastrando todos os fornecedores que fazem parte do nosso banco",
        "de dados, já que foram nossos parceiros ao longo desses anos, nada mais justo prestigiá-los,",
        "nesta nova fase da empresa.",
        "",
        "Para acessar o sistema e realizar o recadastramento, utilize o link abaixo:",
        "https://comprareconstruir.com/login",
        "",
        "Credenciais de acesso:",
        "Usuário: {{email}}",
        "Senha temporária: {{senha}}",
        "No primeiro acesso, será obrigatório trocar a senha.",
        "",
        "IMPORTANTE: NO CADASTRO DE MATERIAIS SERÁ NECESSÁRIO APENAS INSERIR A DESCRIÇÃO",
        "PRINCIPAL DE CADA GRUPO DE MATERIAIS, CONFORME EXEMPLO NO FORMULÁRIO.",
        "ESTE CADASTRO DE MATERIAIS FICARÁ NO NOSSO BANCO DE DADOS PARA DIRECIONAR AS",
        "CONSULTAS DOS NOSSOS CLIENTES ATRAVÉS DE UM LINK QUE SERÁ ENVIADO PELO E-MAIL",
        "DA Comprar E CONSTRUIR PARA OS FORNECEDORES ESPECIALIZADOS QUE COMERCIALIZAM",
        "ESSES MATERIAIS. GERANDO ASSIM, MAIS OPORTUNIDADE DE VENDAS DE TODA A LINHA DE",
        "MATERIAIS.",
        "",
        "Caso haja alguma dúvida não hesite em nos contatar, estaremos à disposição para atendê-los.",
        "Desde já agradeço a atenção de todos.",
        "",
        "Att.",
        "Leonardo Lopes Nogueira.",
        "Diretor Comercial",
        "(31) 99219-4237",
        "",
        "Favor confirmar o recebimento deste e-mail!",
    ].join("\n");
}
