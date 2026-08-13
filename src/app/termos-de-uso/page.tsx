export const metadata = { title: 'Termos de Uso — Florê Ateliê' };

export default function TermosDeUsoPage() {
  return (
    <section style={{ maxWidth: 720, margin: '0 auto', padding: '64px 28px 110px' }}>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(26px,4vw,36px)', fontStyle: 'italic', color: '#4B5740', margin: '0 0 28px' }}>
        Termos de Uso
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontSize: 14, lineHeight: 1.8, color: '#5C5F51' }}>
        <p>Ao utilizar o site da Florê Ateliê, você concorda com os termos abaixo.</p>
        <p>
          <strong style={{ color: '#4B5740' }}>Pedidos e pagamentos.</strong> Os preços exibidos incluem os produtos escolhidos; o frete é calculado
          e exibido antes da confirmação do pagamento. Pagamentos são processados de forma segura via cartão de crédito ou PIX.
        </p>
        <p>
          <strong style={{ color: '#4B5740' }}>Assinaturas.</strong> Você pode pausar, ajustar ou cancelar sua assinatura a qualquer momento pela
          área Minha Conta, antes do próximo ciclo de entrega.
        </p>
        <p>
          <strong style={{ color: '#4B5740' }}>Entregas.</strong> Os prazos e períodos de entrega informados são estimativas operacionais e podem
          variar conforme localidade e disponibilidade do parceiro logístico.
        </p>
        <p>
          <strong style={{ color: '#4B5740' }}>Produtos autorais.</strong> Fotos de catálogo e galeria são ilustrativas; composições artesanais podem
          apresentar pequenas variações naturais entre flores e folhagens da estação.
        </p>
        <p>
          <strong style={{ color: '#4B5740' }}>Dúvidas.</strong> Fale conosco pelo WhatsApp ou em contato@floreatelie.com.br.
        </p>
      </div>
    </section>
  );
}
