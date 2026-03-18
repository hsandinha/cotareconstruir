import React from "react";

export type FornecedorRecadastroEmailProps = {
    logoUrl?: string;
    recipientEmail?: string;
    temporaryPassword?: string | null;
};

export function FornecedorRecadastroEmail({ logoUrl, recipientEmail, temporaryPassword }: FornecedorRecadastroEmailProps) {
    const hasTemporaryPassword = Boolean(temporaryPassword?.trim());

    return (
        <html lang="pt-BR">
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Convite Prioritário: Atualize Seu Perfil na comprareconstruir.com e Impulsione Seus Negócios</title>
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
                                <strong>Prezado(a) Parceiro(a) Fornecedor(a),</strong>
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                Aqui é Leonardo Nogueira, diretor comercial da Cotar e Construir.
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                Com base em nossa sólida experiência de 38 anos no atendimento a milhares de clientes, a Cotar e
                                Construir tem o prazer de apresentar a evolução de nossos serviços: a comprareconstruir.com, nossa
                                plataforma especializada em suprimentos para a construção civil. Esta iniciativa visa otimizar o
                                processo de compras e expandir o alcance de empresas construtoras, engenheiros, arquitetos
                                autônomos e consumidores finais que buscam fornecedores qualificados.
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                <strong>Uma Plataforma Que Prioriza o Seu Negócio (e é Gratuita):</strong>
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                Ao contrário de plataformas genéricas, a comprareconstruir.com foi concebida para ser uma
                                ferramenta estratégica, não apenas um portal de compras. Nosso foco é conectar você a um mercado
                                que valoriza a qualidade da especificação, o compromisso com a entrega e, em seguida, o preço e
                                as condições comerciais mais vantajosas. Queremos garantir que sua empresa esteja na vanguarda,
                                diferenciando-se pela excelência. É importante ressaltar que o acesso e a participação na
                                plataforma não terão custos para você.
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                Para assegurar a continuidade dessa parceria e garantir sua posição privilegiada nesta nova fase,
                                estamos convidando nossos fornecedores mais valiosos a atualizarem seus dados. É nosso
                                compromisso prestar-lhe o devido prestígio por sua trajetória conosco.
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                <strong>Seu Acesso e os Próximos Passos:</strong>
                            </p>

                            <p style={{ margin: "0 0 12px 0", fontSize: 14, lineHeight: "22px" }}>
                                Para acessar o sistema e realizar a atualização de seu perfil, utilize o link seguro abaixo:
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
                                    <p style={{ margin: "0 0 8px 0", fontWeight: 700 }}>
                                        {hasTemporaryPassword ? 'Suas credenciais para o primeiro acesso são:' : 'Seu acesso à plataforma:'}
                                    </p>
                                    {recipientEmail && (
                                        <p style={{ margin: 0 }}>
                                            <strong>Usuário:</strong> {recipientEmail}
                                        </p>
                                    )}
                                    {hasTemporaryPassword && (
                                        <p style={{ margin: 0 }}>
                                            <strong>Senha temporária:</strong> {temporaryPassword}
                                        </p>
                                    )}
                                    {!hasTemporaryPassword && (
                                        <>
                                            <p style={{ margin: 0 }}>
                                                <strong>Senha:</strong> ja cadastrada no sistema
                                            </p>
                                            <p style={{ margin: "8px 0 0 0", color: "#475569", fontSize: 12, lineHeight: "18px" }}>
                                                Use sua senha atual para acessar. Caso nao se recorde dela, solicite a
                                                redefinicao de senha.
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}

                            <p style={{ margin: "16px 0 14px 0", fontSize: 14, lineHeight: "22px", fontWeight: 700 }}>
                                Atenção aos Detalhes Essenciais:
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                {hasTemporaryPassword ? (
                                    <>
                                        <strong>1. Troca de Senha:</strong> No primeiro acesso, será obrigatória a alteração de
                                        sua senha temporária.
                                    </>
                                ) : (
                                    <>
                                        <strong>1. Acesso à Conta:</strong> Utilize seu e-mail cadastrado e a senha ja
                                        cadastrada no sistema para entrar na plataforma. Caso necessario, solicite uma
                                        redefinicao de senha.
                                    </>
                                )}
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                <strong>2. Confirmação de Grupos de Materiais:</strong> No perfil do seu cadastro, solicitamos
                                que confirme cada Grupo de Materiais ou Serviços que sua empresa comercializa. Esta etapa é
                                crucial para que possamos direcionar consultas altamente qualificadas, maximizando suas chances
                                de venda e otimizando seu tempo.
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                <strong>3. Conecte seu WhatsApp Profissional:</strong> É fundamental que você cadastre seu
                                número de WhatsApp profissional na plataforma. Este será o canal exclusivo para receber
                                notificações instantâneas de novas consultas e ordens de compra, garantindo agilidade e
                                maximizando suas oportunidades de negócio em tempo real.
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                Estamos confiantes de que a comprareconstruir.com será um divisor de águas no setor, e queremos
                                que sua empresa esteja na vanguarda dessa transformação.
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                Nossa equipe está à disposição para qualquer dúvida ou suporte durante este processo.
                            </p>

                            <p style={{ margin: "0 0 14px 0", fontSize: 14, lineHeight: "22px" }}>
                                Estou pessoalmente empenhado nesta jornada e à disposição para caminharmos juntos.
                            </p>

                            <div style={{ marginTop: 18, fontSize: 14, lineHeight: "22px" }}>
                                <p style={{ margin: "0 0 10px 0" }}>Atenciosamente,</p>
                                <p style={{ margin: 0 }}>Leonardo Nogueira</p>
                                <p style={{ margin: 0 }}>Diretor Comercial</p>
                                <p style={{ margin: 0 }}>Cotar e Construir</p>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}

export function getFornecedorRecadastroEmailText() {
    const hasTemporaryPassword = true;

    return [
        "Prezado(a) Parceiro(a) Fornecedor(a),",
        "",
        "Aqui é Leonardo Nogueira, diretor comercial da Cotar e Construir.",
        "",
        "Com base em nossa sólida experiência de 38 anos no atendimento a milhares de clientes,",
        "a Cotar e Construir tem o prazer de apresentar a evolução de nossos serviços:",
        "a comprareconstruir.com, nossa plataforma especializada em suprimentos para a",
        "construção civil. Esta iniciativa visa otimizar o processo de compras e expandir o alcance de",
        "empresas construtoras, engenheiros, arquitetos autônomos e consumidores finais que",
        "buscam fornecedores qualificados.",
        "",
        "Uma Plataforma Que Prioriza o Seu Negócio (e é Gratuita):",
        "Ao contrário de plataformas genéricas, a comprareconstruir.com foi concebida para ser",
        "uma ferramenta estratégica, não apenas um portal de compras. Nosso foco é conectar",
        "você a um mercado que valoriza a qualidade da especificação, o compromisso com a",
        "entrega e, em seguida, o preço e as condições comerciais mais vantajosas. Queremos",
        "garantir que sua empresa esteja na vanguarda, diferenciando-se pela excelência. É",
        "importante ressaltar que o acesso e a participação na plataforma não terão custos",
        "para você.",
        "",
        "Para assegurar a continuidade dessa parceria e garantir sua posição privilegiada nesta",
        "nova fase, estamos convidando nossos fornecedores mais valiosos a atualizarem seus",
        "dados. É nosso compromisso prestar-lhe o devido prestígio por sua trajetória conosco.",
        "",
        "Seu Acesso e os Próximos Passos:",
        "Para acessar o sistema e realizar a atualização de seu perfil, utilize o link seguro abaixo:",
        "https://comprareconstruir.com/login",
        "",
        hasTemporaryPassword ? "Suas credenciais para o primeiro acesso são:" : "Seu acesso à plataforma:",
        "Usuário: {{email}}",
        ...(hasTemporaryPassword
            ? ["Senha temporária: {{senha}}"]
            : ["Senha: ja cadastrada no sistema", "Use sua senha atual para acessar. Caso nao se recorde dela, solicite a redefinicao de senha."]),
        "",
        "Atenção aos Detalhes Essenciais:",
        ...(hasTemporaryPassword
            ? ["1. Troca de Senha: No primeiro acesso, será obrigatória a alteração de sua senha", "temporária."]
            : ["1. Acesso à Conta: Utilize seu e-mail cadastrado e a senha ja cadastrada no sistema para entrar na", "plataforma. Caso necessario, solicite uma redefinicao de senha."]),
        "2. Confirmação de Grupos de Materiais: No perfil do seu cadastro, solicitamos que",
        "confirme cada Grupo de Materiais ou Serviços que sua empresa comercializa. Esta etapa é",
        "crucial para que possamos direcionar consultas altamente qualificadas, maximizando suas",
        "chances de venda e otimizando seu tempo.",
        "3. Conecte seu WhatsApp Profissional: É fundamental que você cadastre seu número de",
        "WhatsApp profissional na plataforma. Este será o canal exclusivo para receber",
        "notificações instantâneas de novas consultas e ordens de compra, garantindo agilidade e",
        "maximizando suas oportunidades de negócio em tempo real.",
        "",
        "Estamos confiantes de que a comprareconstruir.com será um divisor de águas no setor, e",
        "queremos que sua empresa esteja na vanguarda dessa transformação.",
        "Nossa equipe está à disposição para qualquer dúvida ou suporte durante este processo.",
        "Estou pessoalmente empenhado nesta jornada e à disposição para caminharmos juntos.",
        "",
        "Atenciosamente,",
        "Leonardo Nogueira",
        "Diretor Comercial",
        "Cotar e Construir",
    ].join("\n");
}
