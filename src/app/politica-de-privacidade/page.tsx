export const metadata = { title: 'Política de Privacidade — Florê Ateliê' };

export default function PoliticaDePrivacidadePage() {
  return (
    <section style={{ maxWidth: 720, margin: '0 auto', padding: '64px 28px 110px' }}>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(26px,4vw,36px)', fontStyle: 'italic', color: '#4B5740', margin: '0 0 28px' }}>
        Política de Privacidade
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontSize: 14, lineHeight: 1.8, color: '#5C5F51' }}>
        <p>A Florê Ateliê respeita sua privacidade e trata seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD).</p>
        <p>
          <strong style={{ color: '#4B5740' }}>Dados de pagamento.</strong> Informações de cartão de crédito são criptografadas e tokenizadas por
          nosso processador de pagamentos — nunca armazenamos números de cartão em texto puro em nossos servidores.
        </p>
        <p>
          <strong style={{ color: '#4B5740' }}>Dados de entrega.</strong> Endereços e telefones são usados exclusivamente para viabilizar entregas e
          comunicação sobre seu pedido ou assinatura.
        </p>
        <p>
          <strong style={{ color: '#4B5740' }}>Seus direitos.</strong> Você pode solicitar a qualquer momento a exclusão, correção ou exportação dos
          seus dados, escrevendo para contato@floreatelie.com.br.
        </p>
        <p>
          <strong style={{ color: '#4B5740' }}>Cookies e mensuração.</strong> Utilizamos ferramentas de mensuração (como Meta Pixel e Google Tag
          Manager) para entender a origem de nossos visitantes e melhorar a experiência do site.
        </p>
      </div>
    </section>
  );
}
