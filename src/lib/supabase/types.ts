/**
 * Hand-written types mirroring supabase/migrations/0001_init.sql.
 *
 * Once the project is linked to a real Supabase instance, replace this file
 * with the generated one for full accuracy:
 *
 *   supabase gen types typescript --linked > src/lib/supabase/types.ts
 */

export type Freq = 'Semanal' | 'Quinzenal' | 'Mensal';
export type Size = 'P' | 'M' | 'G';
export type Weekday = 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado';
export type SubscriptionStatus = 'ativa' | 'pausada' | 'cancelada';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'skipped';
export type OrderKind = 'avulso' | 'assinatura';
export type OrderStatus = 'pendente' | 'em_andamento' | 'entregue' | 'cancelado' | 'pagamento_recusado';
export type PaymentMethod = 'card' | 'pix';
export type DeliveryPeriod = 'manha' | 'tarde';
export type OrderItemType = 'catalog_bouquet' | 'ready_option' | 'inspirado' | 'custom_builder' | 'subscription';
export type BouquetContext = 'catalogo' | 'avulso_pronto';

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string | null;
          nickname: string | null;
          phone: string | null;
          email: string | null;
          mp_customer_id: string | null;
          cpf: string | null;
          welcome_email_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['customers']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['customers']['Row']>;
        Relationships: [];
      };
      admin_users: {
        Row: { id: string; created_at: string };
        Insert: { id: string; created_at?: string };
        Update: Partial<{ id: string; created_at: string }>;
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          customer_id: string;
          cep: string;
          street: string;
          neighborhood: string | null;
          city: string | null;
          state: string | null;
          number: string;
          complement: string | null;
          label: string;
          preferred: boolean;
          lat: number | null;
          lng: number | null;
          distance_km: number | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['addresses']['Row']> & {
          customer_id: string;
          cep: string;
          street: string;
          number: string;
          label: string;
        };
        Update: Partial<Database['public']['Tables']['addresses']['Row']>;
        Relationships: [];
      };
      saved_cards: {
        Row: {
          id: string;
          customer_id: string;
          mp_customer_id: string;
          mp_card_id: string;
          brand: string | null;
          last4: string | null;
          cardholder_name: string | null;
          preferred: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['saved_cards']['Row']> & {
          customer_id: string;
          mp_customer_id: string;
          mp_card_id: string;
        };
        Update: Partial<Database['public']['Tables']['saved_cards']['Row']>;
        Relationships: [];
      };
      flowers: {
        Row: { id: string; name: string; price: number; active: boolean; sort_order: number };
        Insert: Partial<Database['public']['Tables']['flowers']['Row']> & { id: string; name: string; price: number };
        Update: Partial<Database['public']['Tables']['flowers']['Row']>;
        Relationships: [];
      };
      bouquets: {
        Row: {
          id: string;
          context: BouquetContext;
          name: string;
          description: string | null;
          price: number;
          image_path: string;
          category: string | null;
          active: boolean;
          sort_order: number;
        };
        Insert: Partial<Database['public']['Tables']['bouquets']['Row']> & {
          id: string;
          context: BouquetContext;
          name: string;
          price: number;
          image_path: string;
        };
        Update: Partial<Database['public']['Tables']['bouquets']['Row']>;
        Relationships: [];
      };
      gallery_photos: {
        Row: {
          id: string;
          image_path: string;
          caption: string;
          price_p: number;
          price_m: number;
          price_g: number;
          sort_order: number;
        };
        Insert: Partial<Database['public']['Tables']['gallery_photos']['Row']> & {
          image_path: string;
          caption: string;
          price_p: number;
          price_m: number;
          price_g: number;
        };
        Update: Partial<Database['public']['Tables']['gallery_photos']['Row']>;
        Relationships: [];
      };
      testimonials: {
        Row: { id: string; quote: string; author_name: string; sort_order: number; active: boolean };
        Insert: Partial<Database['public']['Tables']['testimonials']['Row']> & { quote: string; author_name: string };
        Update: Partial<Database['public']['Tables']['testimonials']['Row']>;
        Relationships: [];
      };
      subscription_plans: {
        Row: { freq: Freq; size: Size; price: number };
        Insert: { freq: Freq; size: Size; price: number };
        Update: Partial<{ freq: Freq; size: Size; price: number }>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          customer_id: string;
          freq: Freq;
          size: Size;
          weekday: Weekday;
          status: SubscriptionStatus;
          message: string;
          recipient_name: string | null;
          address_id: string | null;
          card_id: string | null;
          /** Mercado Pago Preapproval id driving this subscription's
           * recurring charges (see supabase/migrations/0012_preapproval.sql).
           * Null for any subscription predating that migration. */
          mp_preapproval_id: string | null;
          price: number;
          paused_since: string | null;
          pending_action: { type: 'pause' | 'cancel'; effective_date: string } | null;
          pending_plan_change: { freq: Freq; size: Size; effective_date: string } | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['subscriptions']['Row']> & {
          customer_id: string;
          freq: Freq;
          size: Size;
          weekday: Weekday;
          price: number;
        };
        Update: Partial<Database['public']['Tables']['subscriptions']['Row']>;
        Relationships: [];
      };
      subscription_deliveries: {
        Row: {
          id: string;
          subscription_id: string;
          sequence_index: number;
          delivery_date: string;
          cutoff_date: string;
          message: string;
          recipient_name: string | null;
          payment_status: PaymentStatus;
          charged_at: string | null;
          mp_payment_id: string | null;
          reminder_email_sent_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['subscription_deliveries']['Row']> & {
          subscription_id: string;
          sequence_index: number;
          delivery_date: string;
          cutoff_date: string;
        };
        Update: Partial<Database['public']['Tables']['subscription_deliveries']['Row']>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          customer_id: string;
          kind: OrderKind;
          subscription_delivery_id: string | null;
          status: OrderStatus;
          subtotal: number;
          shipping_fee: number;
          total: number;
          address_id: string | null;
          delivery_date: string | null;
          delivery_period: DeliveryPeriod | null;
          payment_method: PaymentMethod | null;
          installments: number;
          mp_payment_id: string | null;
          mp_status: string | null;
          message: string | null;
          recipient_name: string | null;
          /** Last order.status we've already sent the customer an email
           * about (see src/lib/email) — prevents a webhook redelivery from
           * re-sending the same confirmation/decline email. */
          status_email_sent_for: string | null;
          admin_notified_at: string | null;
          reminder_email_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['orders']['Row']> & { customer_id: string; kind: OrderKind };
        Update: Partial<Database['public']['Tables']['orders']['Row']>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          item_type: OrderItemType;
          ref_id: string | null;
          name_snapshot: string;
          unit_price: number;
          qty: number;
          subtotal: number;
        };
        Insert: Partial<Database['public']['Tables']['order_items']['Row']> & {
          order_id: string;
          item_type: OrderItemType;
          name_snapshot: string;
          unit_price: number;
          subtotal: number;
        };
        Update: Partial<Database['public']['Tables']['order_items']['Row']>;
        Relationships: [];
      };
      order_item_flowers: {
        Row: { order_item_id: string; flower_id: string; qty: number };
        Insert: { order_item_id: string; flower_id: string; qty: number };
        Update: Partial<{ order_item_id: string; flower_id: string; qty: number }>;
        Relationships: [];
      };
      settings: {
        Row: { key: string; value: unknown; updated_at: string };
        Insert: { key: string; value: unknown; updated_at?: string };
        Update: Partial<{ key: string; value: unknown; updated_at: string }>;
        Relationships: [];
      };
      cep_cache: {
        Row: {
          cep: string;
          street: string | null;
          neighborhood: string | null;
          city: string | null;
          state: string | null;
          lat: number | null;
          lng: number | null;
          distance_km: number | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['cep_cache']['Row']> & { cep: string };
        Update: Partial<Database['public']['Tables']['cep_cache']['Row']>;
        Relationships: [];
      };
      webhook_events: {
        Row: {
          id: string;
          provider: string;
          event_type: string | null;
          payload: unknown;
          processed_at: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['webhook_events']['Row']> & { payload: unknown };
        Update: Partial<Database['public']['Tables']['webhook_events']['Row']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      subtract_business_days: { Args: { d: string; n: number }; Returns: string };
      next_weekday_on_or_after: { Args: { d: string; weekday_name: string }; Returns: string };
      freq_step_days: { Args: { freq: Freq }; Returns: number };
      is_cutoff_passed: { Args: { p_cutoff_date: string }; Returns: boolean };
      next_delivery_after: { Args: { prev_date: string; freq: Freq; weekday_name: string }; Returns: string };
      build_delivery_schedule: {
        Args: {
          p_subscription_id: string;
          p_freq: Freq;
          p_weekday: Weekday;
          p_count: number;
          p_message: string;
          p_recipient_name?: string | null;
          p_first_delivery_date?: string | null;
        };
        Returns: Database['public']['Tables']['subscription_deliveries']['Row'][];
      };
    };
  };
}
