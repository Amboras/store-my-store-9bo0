import type { Metadata } from 'next'
import { getPolicies } from '@/lib/get-policies'
import { Truck, RotateCcw, Package } from 'lucide-react'
import { PolicyMarkdown } from '@/components/policy-markdown'

export const metadata: Metadata = {
  title: 'Shipping & Returns',
  description: 'Shipping methods, delivery times, return policy, and exchange information.',
}

export default async function ShippingPage() {
  const policies = await getPolicies()

  const shippingPolicy = policies?.shipping_policy
  const updatedAt = policies?.updated_at
    ? new Date(policies.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : null

  return (
    <>
      <div className="border-b">
        <div className="container-custom py-section-sm text-center">
          <h1 className="text-h1 font-heading font-semibold">Shipping & Returns</h1>
          {updatedAt && (
            <p className="mt-2 text-sm text-muted-foreground">Last updated: {updatedAt}</p>
          )}
        </div>
      </div>

      <div className="container-custom py-section max-w-3xl">
        {shippingPolicy ? (
          <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
            <PolicyMarkdown content={shippingPolicy} />
          </div>
        ) : (
          <div className="space-y-12">
            <section>
              <div className="flex items-center gap-3 mb-6">
                <Truck className="h-6 w-6" strokeWidth={1.5} />
                <h2 className="text-h3 font-heading font-semibold">Shipping</h2>
              </div>
              <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                <p>Many of our items are shipped directly from our overseas fulfillment partners. Orders are typically processed within 2–4 business days before dispatch.</p>

                <div className="border rounded-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/50"><th className="text-left p-3 font-medium">Method</th><th className="text-left p-3 font-medium">Delivery Time</th><th className="text-left p-3 font-medium">Cost</th></tr></thead>
                    <tbody>
                      <tr className="border-t"><td className="p-3">Standard (Overseas)</td><td className="p-3">7–20 business days</td><td className="p-3">Free over $75 / $5.99</td></tr>
                      <tr className="border-t"><td className="p-3">Express (Overseas)</td><td className="p-3">5–10 business days</td><td className="p-3">$14.99</td></tr>
                      <tr className="border-t"><td className="p-3">Domestic Stock</td><td className="p-3">3–5 business days</td><td className="p-3">$8.99</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="border-l-2 border-accent bg-muted/30 p-4 rounded-sm">
                  <p className="font-medium text-foreground mb-1">📦 A note on delivery times</p>
                  <p>A portion of our catalog ships from our overseas fulfillment network, which keeps prices competitive but means delivery can take longer than domestic-stock orders. We&apos;ll always show estimated delivery at checkout, and every shipment comes with full tracking.</p>
                </div>

                <p>All orders include tracking information sent to your email once shipped.</p>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-6">
                <RotateCcw className="h-6 w-6" strokeWidth={1.5} />
                <h2 className="text-h3 font-heading font-semibold">Returns</h2>
              </div>
              <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                <p>We want you to love your purchase. If something isn&apos;t right, we accept returns within 30 days of delivery.</p>
                <ul className="list-disc list-inside space-y-2">
                  <li>Items must be unworn, unwashed, and in original condition with tags attached</li>
                  <li>Sale items are final sale and cannot be returned</li>
                  <li>Return shipping is free for domestic orders</li>
                  <li>Refunds are processed within 5-7 business days after we receive the return</li>
                </ul>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-6">
                <Package className="h-6 w-6" strokeWidth={1.5} />
                <h2 className="text-h3 font-heading font-semibold">Exchanges</h2>
              </div>
              <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                <p>Need a different size or color? We offer free exchanges on all full-price items. Simply initiate an exchange through your account or contact our support team.</p>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  )
}
