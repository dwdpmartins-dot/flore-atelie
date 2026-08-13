export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-xs uppercase tracking-[3px] text-terracotta">
        Ateliê floral autoral
      </span>
      <h1 className="font-serif text-4xl italic text-forest">
        Onde o cuidado floresce.
      </h1>
      <p className="max-w-md text-sm text-muted">
        Scaffold em andamento — as telas reais (Home, Catálogo, Assinatura,
        Monte seu Buquê, Checkout, Minha Conta, Admin) estão sendo portadas do
        protótipo em <code>project/Flore Atelie.dc.html</code>.
      </p>
    </main>
  );
}
