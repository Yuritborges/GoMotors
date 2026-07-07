/**
 * Gera o Manual do Sistema GoMotors em formato Word (.docx).
 * Uso: npx tsx scripts/generate-manual-docx.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  PageBreak,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const IMG_DIR = path.join(process.cwd(), "docs", "manual", "imagens");
const OUT_FILE = path.join(process.cwd(), "docs", "manual", "MANUAL-GOMOTORS.docx");

function img(file: string, w = 620, h = 388): ImageRun | null {
  const p = path.join(IMG_DIR, file);
  if (!fs.existsSync(p)) return null;
  return new ImageRun({
    data: fs.readFileSync(p),
    transformation: { width: w, height: h },
    type: file.endsWith(".png") ? "png" : "jpg",
  });
}

function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: "0C4A6E" })],
  });
}

function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: "0369A1" })],
  });
}

function h3(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22 })],
  });
}

function p(text: string) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function bullet(text: string) {
  return new Paragraph({
    spacing: { after: 60 },
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function numbered(text: string) {
  return new Paragraph({
    spacing: { after: 80 },
    numbering: { reference: "steps", level: 0 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function screenshot(file: string, caption: string) {
  const image = img(file);
  const parts: Paragraph[] = [];
  if (image) {
    parts.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 80 },
        children: [image],
      })
    );
  }
  parts.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: caption, italics: true, size: 18, color: "64748B" })],
    })
  );
  return parts;
}

function tip(text: string) {
  return new Paragraph({
    spacing: { before: 80, after: 160 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: "0EA5E9" },
    },
    indent: { left: 200 },
    children: [
      new TextRun({ text: "Dica: ", bold: true, size: 22, color: "0369A1" }),
      new TextRun({ text, size: 22 }),
    ],
  });
}

function warn(text: string) {
  return new Paragraph({
    spacing: { before: 80, after: 160 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: "F59E0B" },
    },
    indent: { left: 200 },
    children: [
      new TextRun({ text: "Atenção: ", bold: true, size: 22, color: "B45309" }),
      new TextRun({ text, size: 22 }),
    ],
  });
}

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "steps",
        levels: [
          {
            level: 0,
            format: "decimal",
            text: "%1.",
            alignment: AlignmentType.START,
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {},
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "GoMotors — Manual do Sistema v1.0 · go-motors-ten.vercel.app",
                  size: 16,
                  color: "94A3B8",
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        // CAPA
        new Paragraph({ spacing: { before: 1200 } }),
        ...(img("logo.png", 220, 80)
          ? [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [img("logo.png", 220, 80)!],
              }),
            ]
          : []),
        new Paragraph({ spacing: { before: 400 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "MANUAL DO SISTEMA",
              bold: true,
              size: 56,
              color: "0C4A6E",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120 },
          children: [
            new TextRun({
              text: "Go Motors — Gestão de Lavagem",
              size: 32,
              color: "0369A1",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 600 },
          children: [
            new TextRun({ text: "Versão 1.0 — Julho/2026", size: 24 }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80 },
          children: [
            new TextRun({
              text: "Documento para operação, treinamento e consulta",
              size: 22,
              italics: true,
              color: "64748B",
            }),
          ],
        }),
        new Paragraph({ children: [new PageBreak()] }),

        // ÍNDICE (manual)
        h1("Índice"),
        ...[
          "1. Introdução",
          "2. Acesso ao sistema",
          "3. Perfis de usuário",
          "4. Rotina do dia a dia",
          "5. Dashboard",
          "6. Painel operacional",
          "7. Nova ordem de serviço",
          "8. Ordens de serviço",
          "9. Clientes e veículos",
          "10. Caixa (fechamento diário)",
          "11. Financeiro",
          "12. Despesas",
          "13. Funcionários e vales",
          "14. Serviços e preços",
          "15. Estoque",
          "16. Relatórios",
          "17. Usuários",
          "18. Telão na TV",
          "19. Uso no celular",
          "20. Perguntas frequentes",
          "21. Limitações e suporte",
        ].map((item) => bullet(item)),
        new Paragraph({ children: [new PageBreak()] }),

        // 1 INTRODUÇÃO
        h1("1. Introdução"),
        p(
          "O GoMotors é o sistema de gestão do lava-rápido Go Motors. Ele foi feito para uso interno da equipe — não é um site de divulgação. Por meio dele você controla a fila de lavagem, registra pagamentos, acompanha o caixa do dia, consulta o financeiro mensal e gerencia clientes, funcionários e estoque."
        ),
        p(
          "O sistema funciona no navegador (computador, celular ou tablet) e precisa de internet. Os dados ficam salvos na nuvem (banco PostgreSQL na Neon), então qualquer aparelho com login acessa as mesmas informações em tempo real."
        ),
        h3("Links importantes"),
        bullet("Sistema: https://go-motors-ten.vercel.app"),
        bullet("Telão (TV na recepção): https://go-motors-ten.vercel.app/display"),
        new Paragraph({ children: [new PageBreak()] }),

        // 2 ACESSO
        h1("2. Acesso ao sistema"),
        p("Abra o link do sistema no navegador (Chrome recomendado). Na tela de login, informe o e-mail e a senha cadastrados em Usuários."),
        ...screenshot("01-login.png", "Figura 1 — Tela de login"),
        h3("Como entrar"),
        numbered("Acesse https://go-motors-ten.vercel.app"),
        numbered("Digite seu e-mail (ex.: matheuspoli@gomotors.local)"),
        numbered("Digite sua senha"),
        numbered('Clique em "Entrar"'),
        tip("Guarde a senha em local seguro. Para alterar, peça a um administrador em Usuários ou use o suporte técnico."),
        warn("Não compartilhe a senha de administrador com atendentes. Crie um login de Atendente para cada funcionário da recepção."),
        new Paragraph({ children: [new PageBreak()] }),

        // 3 PERFIS
        h1("3. Perfis de usuário"),
        p("O sistema possui dois perfis principais:"),
        h3("Administrador (Proprietário)"),
        p("Acesso completo: caixa, financeiro, relatórios, despesas, estoque, funcionários, serviços, usuários e auditoria."),
        h3("Atendente"),
        p("Acesso operacional: painel, nova ordem, ordens, clientes, serviços (somente consulta) e comprovantes. Não vê caixa, financeiro nem relatórios."),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: ["Módulo", "Administrador", "Atendente"].map(
                (t) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })],
                  })
              ),
            }),
            ...[
              ["Painel / Nova OS", "Sim", "Sim"],
              ["Clientes", "Sim", "Sim"],
              ["Caixa", "Sim", "Não"],
              ["Financeiro", "Sim", "Não"],
              ["Relatórios", "Sim", "Não"],
              ["Usuários", "Sim", "Não"],
              ["Estoque", "Sim", "Não"],
            ].map(
              (row) =>
                new TableRow({
                  children: row.map(
                    (t) =>
                      new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: t })] })],
                      })
                  ),
                })
            ),
          ],
        }),
        new Paragraph({ children: [new PageBreak()] }),

        // 4 ROTINA
        h1("4. Rotina do dia a dia"),
        p("Fluxo recomendado para a operação diária do lava-rápido:"),
        numbered("Cliente chega → abra Nova ordem, cadastre ou busque o veículo pela placa"),
        numbered("Selecione os serviços e o funcionário de cada etapa"),
        numbered("Informe a forma de pagamento (PIX, dinheiro, débito, crédito ou pagar depois)"),
        numbered("Acompanhe o carro no Painel operacional — avance as etapas conforme a lavagem"),
        numbered("Quando estiver pronto, receba o pagamento (se pendente) e libere o veículo"),
        numbered("Entregue o comprovante (impressão ou WhatsApp)"),
        numbered("No fim do dia, confira o Caixa com a data do dia"),
        numbered("No fim do mês, consulte o Financeiro"),
        tip("O telão na TV (/display) mostra a fila para o cliente acompanhar sem precisar perguntar na recepção."),
        new Paragraph({ children: [new PageBreak()] }),

        // 5 DASHBOARD
        h1("5. Dashboard"),
        p("A página inicial resume o dia: veículos atendidos, receita, fila atual e atalhos rápidos."),
        ...screenshot("02-dashboard.png", "Figura 2 — Dashboard"),
        new Paragraph({ children: [new PageBreak()] }),

        // 6 PAINEL
        h1("6. Painel operacional"),
        p(
          "O painel é o coração da operação. Os veículos aparecem em colunas por etapa: Aguardando, Lavagem, Aspiração, Secagem, Finalização, Pronto."
        ),
        ...screenshot("03-painel.png", "Figura 3 — Painel operacional (Kanban)"),
        h3("O que fazer no painel"),
        bullet("Arrastar ou usar os botões para avançar o veículo de etapa"),
        bullet('Clicar em "Receber" para registrar pagamento de ordens pendentes'),
        bullet('Clicar em "Entregar" quando o carro estiver pronto e pago'),
        bullet("Ver todos os serviços do veículo em cada card"),
        tip("Mantenha o painel aberto em um computador ou tablet na recepção durante o expediente."),
        new Paragraph({ children: [new PageBreak()] }),

        // 7 NOVA ORDEM
        h1("7. Nova ordem de serviço"),
        p("Use Nova ordem no menu (ou o atalho + no celular) para registrar a entrada de um veículo."),
        ...screenshot("04-nova-ordem.png", "Figura 4 — Nova ordem de serviço"),
        h3("Passo a passo"),
        numbered("Digite a placa — o sistema busca o veículo automaticamente"),
        numbered("Se for cliente novo, preencha nome e dados do veículo"),
        numbered("Marque os serviços (lavagem simples, completa, chassi, motor, etc.)"),
        numbered("Atribua o funcionário responsável por cada etapa"),
        numbered("Aplique desconto se necessário"),
        numbered("Escolha a forma de pagamento"),
        numbered('Clique em "Registrar ordem"'),
        tip("É possível usar a câmera do celular para ler a placa (OCR). Aponte bem a placa com boa iluminação."),
        warn('Se o veículo já estiver na fila (aguardando ou em lavagem), o sistema bloqueia nova ordem até finalizar a atual.'),
        new Paragraph({ children: [new PageBreak()] }),

        // 8 ORDENS
        h1("8. Ordens de serviço"),
        p("Lista todas as ordens do dia (ou filtradas). Permite consultar status, valores e abrir o comprovante."),
        ...screenshot("05-ordens.png", "Figura 5 — Lista de ordens"),
        bullet("Clique em uma ordem para ver detalhes"),
        bullet("Use o comprovante para imprimir ou enviar link pelo WhatsApp"),
        new Paragraph({ children: [new PageBreak()] }),

        // 9 CLIENTES
        h1("9. Clientes e veículos"),
        p("Cadastro de clientes com seus veículos. Busque por nome ou placa. Veja o histórico de lavagens de cada cliente."),
        ...screenshot("06-clientes.png", "Figura 6 — Clientes"),
        bullet("Clientes rotativos (avulsos) podem ser cadastrados só com placa e modelo"),
        bullet("Lojas parceiras têm módulo próprio em Clientes → Lojas parceiras"),
        new Paragraph({ children: [new PageBreak()] }),

        // 10 CAIXA
        h1("10. Caixa (fechamento diário)"),
        p(
          "O Caixa mostra a movimentação de um dia específico: quanto entrou, formas de pagamento, veículos, despesas do dia e lucro estimado. Inclui dados importados das planilhas históricas."
        ),
        ...screenshot("07-caixa.png", "Figura 7 — Caixa com filtro por data"),
        h3("Filtro por data"),
        p('Na barra azul "Data do fechamento", use o calendário ou as setas ← → para ver qualquer dia.'),
        h3("Pendências"),
        p('Ordens com "pagar depois" ou mensalidade aparecem em Caixa → Pendências. Lá você quita os valores no fechamento.'),
        tip("Confira o caixa todo dia ao fechar o expediente. Compare com o dinheiro físico e o extrato da maquininha."),
        new Paragraph({ children: [new PageBreak()] }),

        // 11 FINANCEIRO
        h1("11. Financeiro"),
        p("Visão gerencial: receita, despesas, lucro líquido, gráfico de fluxo diário e demonstrativo (DRE) do período."),
        ...screenshot("08-financeiro.png", "Figura 8 — Financeiro"),
        h3("Por mês"),
        p('Selecione o mês no campo "Período (mês)" para ver o resumo mensal.'),
        h3("Por dia"),
        p('Clique em "Por dia" e escolha a data para ver receita e despesas de um único dia. O botão "Caixa do dia" leva direto ao fechamento.'),
        bullet("Exportar CSV para planilha externa"),
        new Paragraph({ children: [new PageBreak()] }),

        // 12 DESPESAS
        h1("12. Despesas"),
        p("Registre despesas operacionais: aluguel, produtos, compras diversas, etc. Categorize para aparecer no financeiro."),
        ...screenshot("09-despesas.png", "Figura 9 — Despesas"),
        new Paragraph({ children: [new PageBreak()] }),

        // 13 FUNCIONARIOS
        h1("13. Funcionários e vales"),
        p("Cadastre os funcionários da equipe. Registre vales, reembolsos e descontos. Os vales entram automaticamente nas despesas do período."),
        ...screenshot("10-funcionarios.png", "Figura 10 — Funcionários"),
        new Paragraph({ children: [new PageBreak()] }),

        // 14 SERVIÇOS
        h1("14. Serviços e preços"),
        p("Lista de serviços oferecidos com preços por tipo de veículo (carro, SUV, moto, etc.). Somente administrador altera valores."),
        ...screenshot("11-servicos.png", "Figura 11 — Serviços"),
        new Paragraph({ children: [new PageBreak()] }),

        // 15 ESTOQUE
        h1("15. Estoque"),
        p("Controle de produtos e insumos. Alertas quando o estoque estiver baixo."),
        ...screenshot("12-estoque.png", "Figura 12 — Estoque"),
        new Paragraph({ children: [new PageBreak()] }),

        // 16 RELATÓRIOS
        h1("16. Relatórios"),
        p("Exportação de dados e relatórios gerenciais para análise e backup."),
        ...screenshot("13-relatorios.png", "Figura 13 — Relatórios"),
        new Paragraph({ children: [new PageBreak()] }),

        // 17 USUÁRIOS
        h1("17. Usuários"),
        p("Crie logins para atendentes e outros administradores. Altere e-mail e senha. Desative usuários que saíram da equipe."),
        ...screenshot("14-usuarios.png", "Figura 15 — Usuários"),
        warn("Cada pessoa deve ter seu próprio login. Não use o mesmo usuário em dois computadores com perfis diferentes."),
        new Paragraph({ children: [new PageBreak()] }),

        // 18 TELÃO
        h1("18. Telão na TV"),
        p(
          "Abra https://go-motors-ten.vercel.app/display em um navegador na TV da recepção. Não precisa de login. Mostra a fila em tempo real com placa e status."
        ),
        ...screenshot("15-display.png", "Figura 14 — Telão / Display"),
        h3("Configurar a TV"),
        numbered("Abra o link /display no navegador da TV"),
        numbered("Pressione F11 para tela cheia (ou equivalente no controle remoto)"),
        numbered("Deixe o navegador aberto durante o expediente"),
        tip("Adicione o link aos favoritos da TV para abrir rápido todo dia."),
        new Paragraph({ children: [new PageBreak()] }),

        // 19 CELULAR
        h1("19. Uso no celular"),
        p("O sistema é responsivo e funciona bem no celular."),
        bullet("Barra inferior com atalhos: Painel, Nova ordem e Clientes"),
        bullet("Menu (☰) para acessar as demais páginas"),
        bullet("Nova ordem com câmera para ler placa"),
        bullet("Comprovante com botão WhatsApp visível"),
        tip('No celular, use "Adicionar à tela inicial" para criar um atalho como se fosse um app.'),
        new Paragraph({ children: [new PageBreak()] }),

        // 20 FAQ
        h1("20. Perguntas frequentes"),
        h3("O sistema funciona sem internet?"),
        p("Não. É necessário internet (Wi-Fi ou 4G). Em caso de queda, use hotspot do celular como backup."),
        h3("Esqueci minha senha"),
        p("Peça a outro administrador para redefinir em Usuários, ou contate o suporte técnico."),
        h3("O caixa está zerado mas teve movimento"),
        p("Verifique se selecionou a data correta na barra azul do Caixa. Dados de planilhas antigas aparecem ao escolher o dia correspondente."),
        h3("Cliente quer pagar depois"),
        p('Na nova ordem, escolha "Pagar depois". O carro pode ser liberado. Quite depois em Caixa → Pendências.'),
        h3("Mensalidade de loja parceira"),
        p('Use "Fechamento mensal" como pagamento. Lance no fim do mês e quite nas pendências.'),
        h3("Como imprimir o comprovante?"),
        p("Abra a ordem → Comprovante → use o botão Imprimir do navegador (Ctrl+P)."),
        new Paragraph({ children: [new PageBreak()] }),

        // 21 LIMITAÇÕES
        h1("21. Limitações e suporte"),
        h3("O que o sistema NÃO faz (ainda)"),
        bullet("Nota fiscal eletrônica (NF-e)"),
        bullet("Envio automático de WhatsApp (só link manual no comprovante)"),
        bullet("Funcionar offline"),
        h3("Em caso de problema"),
        bullet("Sistema lento ou erro 500: verifique internet e aguarde alguns minutos"),
        bullet("Bug após atualização: contate o suporte para rollback na Vercel"),
        bullet("Dúvida de uso: consulte este manual"),
        new Paragraph({ spacing: { before: 600 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "— Fim do manual —",
              size: 24,
              italics: true,
              color: "64748B",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120 },
          children: [
            new TextRun({
              text: "Go Motors · Sistema GoMotors v1.0",
              size: 22,
              bold: true,
              color: "0C4A6E",
            }),
          ],
        }),
      ],
    },
  ],
});

async function main() {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT_FILE, buffer);
  console.log(`Manual gerado: ${OUT_FILE}`);
  console.log(`Imagens em: ${IMG_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
