# CanchasApp UI Guidelines

This document describes the UI language already established in CanchasApp and the conventions new work should follow. It is based on the current marketing, authentication, dashboard, and shared component code.

## Design Direction

CanchasApp should feel practical, trustworthy, and sports-oriented rather than decorative. The visual language is built around:

- A restrained green brand palette with neutral surfaces.
- Clear hierarchy, compact controls, and generous content spacing.
- Rounded cards and controls with subtle borders and shadows.
- Responsive layouts that simplify rather than merely shrink.
- Familiar, accessible interaction patterns provided by Radix UI.
- Spanish product copy that is concise and action-oriented.

Prefer clarity and consistency over introducing a new visual treatment for each feature.

## Technical Foundation

- Use Next.js App Router, React, TypeScript, and Tailwind CSS utilities.
- Use the shadcn/ui New York-style primitives in `src/components/ui` before creating a new primitive.
- Use Radix UI for accessible dialogs, menus, popovers, tabs, selects, and similar interactions.
- Use Lucide icons from `lucide-react`.
- Use `cn()` from `src/lib/utils.ts` to merge conditional classes.
- Keep components as Server Components unless state, effects, browser APIs, or event handlers require `'use client'`.
- Use CVA when a reusable component has multiple visual variants. Do not scatter equivalent variant logic across pages.

Representative sources:

- Theme and tokens: `src/app/globals.css`
- Shared primitives: `src/components/ui`
- Application shell: `src/components/layout`
- Marketing sections: `src/components/landing`
- Dashboard composition: `src/app/dashboard/page.tsx`
- Structured form pattern: `src/app/dashboard/settings/profile/page.tsx`

## Color And Theme

Use semantic Tailwind classes backed by the CSS variables in `src/app/globals.css`:

| Purpose | Preferred classes |
| --- | --- |
| Page surface | `bg-background text-foreground` |
| Elevated surface | `bg-card text-card-foreground` |
| Primary action or emphasis | `bg-primary text-primary-foreground`, `text-primary` |
| Secondary action | `bg-secondary text-secondary-foreground` |
| Supporting surface | `bg-muted`, `bg-accent` |
| Supporting text | `text-muted-foreground` |
| Dividers and outlines | `border-border` |
| Destructive action or error | `bg-destructive`, `text-destructive` |
| Keyboard focus | Existing `ring-ring` primitive styles |

The primary brand color is jewel green (`#0e6749` in light mode and `#1a8a66` in dark mode). Use translucency such as `bg-primary/10` for icon wells, badges, and quiet emphasis. Do not hard-code brand colors in feature components.

All new UI must work in both light and dark themes. Use the custom provider from `src/contexts/theme-provider.tsx`; do not import `useTheme` from `next-themes`. Never add a light-only foreground, border, or background without checking its dark-mode contrast.

For domain statuses such as confirmed, pending, and cancelled, use a shared badge or CVA variant when the treatment appears more than once. Status color may be green, amber, or red, but the label must remain visible and must not rely on color alone.

## Typography

- Use `font-sans`; do not set a font family inside feature components.
- Page title: `text-2xl font-bold tracking-tight`.
- Page description: `text-sm text-muted-foreground`.
- Card or subsection title: `text-lg font-medium` or `font-semibold`.
- Body text: `text-sm` or `text-base`.
- Supporting labels and metadata: `text-xs text-muted-foreground` or `text-sm text-muted-foreground`.
- Marketing section title: `text-2xl sm:text-3xl md:text-4xl font-bold`.
- Marketing hero title: `text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight`.

Use semantic heading elements in order. A visual card title still needs an appropriate `h2`, `h3`, or `h4` when it names a section; the shared `CardTitle` currently renders a `div`, so pass or wrap a semantic heading where needed.

Keep UI copy in Spanish unless the product requirements explicitly call for another language. Use sentence case for descriptions and clear verbs for actions, for example `Guardar cambios`, `Ver reservas`, or `Iniciar sesión`.

## Spacing And Shape

Use Tailwind's standard spacing scale and follow these recurring values:

- Page content: `px-4 py-6` through the shared `Main` or `Content` wrapper.
- Dashboard grids: `gap-6`, with related sections separated by `mt-6`.
- Card internals: `p-6`, or the default `CardHeader` and `CardContent` spacing.
- Forms: `space-y-2` within a field, `space-y-4` or `space-y-6` between groups, and up to `space-y-8` for long settings forms.
- Marketing sections: `py-12 sm:py-16 md:py-20`.
- Marketing containers: `container mx-auto px-4 sm:px-6 lg:px-8`.
- Controls: use primitive heights, normally `h-9`, rather than inventing custom heights.

The base radius is `0.625rem`. Use:

- `rounded-md` for controls.
- `rounded-lg` for nested rows and small panels.
- `rounded-xl` for standard cards.
- `rounded-full` for status pills, avatars, and circular icon wells.

Prefer `border` and `shadow-sm` for elevation. Reserve stronger shadows such as `shadow-lg` for a featured marketing visual or a truly elevated overlay.

## Layout Patterns

### Dashboard Pages

Dashboard routes must use the active shell in `src/app/dashboard/layout.tsx` and the wrappers in `src/components/layout`. Do not recreate the sidebar or header within a page.

A typical dashboard page starts with a title block and then responsive grids:

```tsx
<Content>
    <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Reservas</h1>
        <p className="text-sm text-muted-foreground">
            Consulta y administra las reservas de tus sedes.
        </p>
    </div>

    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Summary cards */}
    </div>
</Content>
```

- Let `Main` constrain standard content to `max-w-7xl`.
- Use `fluid` only for views that genuinely need the full available width, such as dense tables or schedules.
- Collapse to one column by default, then add `md:` and `lg:` columns.
- Keep the primary page action near the title on wide screens and stack it below the title on small screens.
- Use cards for grouped summaries and bordered rows for compact lists inside cards.

### Marketing Pages

Marketing sections are spacious, centered, and mobile-first:

- Alternate `bg-background` with quiet sections such as `bg-muted/30 dark:bg-muted/20`.
- Keep section copy centered and constrained to approximately `max-w-2xl`.
- Use one column by default and expand to two or four columns at `md` or `lg`.
- Stack calls to action at mobile widths with `flex-col sm:flex-row` and `w-full sm:w-auto`.
- Use primary green gradients or glows sparingly as background atmosphere, not behind body text.
- Use `next/image`, meaningful `alt` text for content images, and `alt=""` plus `aria-hidden` for decoration.

### Authentication Pages

Authentication uses a centered, constrained form and an optional branded visual panel:

- Form width: `w-full max-w-md`.
- Form card: `bg-card`, `border`, `rounded-2xl`, `shadow-sm`, and approximately `p-8 sm:p-10`.
- At `lg`, a split-screen branded image panel may occupy half the viewport.
- Below `lg`, hide the decorative panel and keep the form focused and vertically centered.
- Make the submit action full width.

## Components

### Buttons

Always start with `Button` from `src/components/ui/button.tsx`.

- `default`: one primary action per region.
- `secondary`: a supporting branded action.
- `outline`: secondary actions such as cancel, view all, or alternate paths.
- `ghost`: toolbar, menu, and low-emphasis actions.
- `destructive`: irreversible or dangerous actions.
- `link`: text-level navigation.
- Use `asChild` with `Link`; do not place an anchor inside a button without it.
- Use `size="icon"` for icon-only controls and always provide an accessible name.
- Disable an action while it is submitting and change its label to an explicit progress phrase such as `Guardando...`.

Avoid multiple visually dominant buttons in the same card or form.

### Cards

Use `Card`, `CardHeader`, `CardContent`, and `CardFooter` rather than rebuilding card surfaces. Standard cards use `rounded-xl border bg-card shadow-sm` and six-unit spacing.

Summary cards typically contain:

- A muted, small label.
- A bold `text-2xl` value.
- A short muted trend or context line.
- An optional `size-10 rounded-full bg-primary/10 text-primary` icon well.

Do not nest full cards when a `rounded-lg border p-3` row or panel is sufficient.

### Forms

For production forms, prefer React Hook Form, Zod, and the shared form components:

- `FormField` for field state.
- `FormLabel` associated with every control.
- `FormDescription` only when it adds useful guidance.
- `FormMessage` for inline validation feedback.
- `aria-invalid` and `aria-describedby` behavior from the shared primitives.

Use the native input type and appropriate `autoComplete` value. Keep placeholders as examples, not replacements for labels. Show validation errors beside the relevant field; reserve Sonner toasts for submission-level success or failure.

On submission:

- Keep entered values intact after an error.
- Disable the submit action while pending.
- Show a specific pending label or spinner.
- Show a success toast only after confirmed success.
- Move focus to the first invalid field when practical.

### Dialogs And Menus

Use the shared Radix-based primitives. Destructive confirmation should use `AlertDialog` or `ConfirmDialog`, with a specific title and consequence-focused description. Use `Dialog` for workflows that are not merely confirmations.

Menus and popovers must be keyboard accessible and should close after a completed action. Keep menu labels short and pair unfamiliar actions with a Lucide icon.

### Icons And Images

- Use Lucide instead of mixing icon libraries.
- Standard inline icons are `size-4`; prominent card icons are usually `size-5` inside a `size-10` well.
- Decorative icons should have `aria-hidden="true"` when needed.
- Icon-only controls require an `aria-label` or visible-to-screen-readers text.
- Use the logo files in `public/logos` and verify an asset exists before referencing it.
- Use `next/image` for raster and content images, with responsive sizing and an intentional aspect ratio.

## UI States And Feedback

Every data-driven view must define these states before it is considered complete:

- Loading: use `Skeleton` for page and card content when the shape is known. Preserve layout to avoid jumps.
- Empty: explain that no data exists and provide the most useful next action where applicable.
- Error: state what failed and offer retry or recovery when possible.
- Success: update the visible UI first and use a concise Sonner toast for confirmation.
- Pending action: disable duplicate submission and expose progress in the triggering control.

Do not render only plain `Cargando...` or `Error...` text for a finished page. Do not leave lists blank when their collection is empty.

## Responsive Behavior

Build mobile-first and test at narrow mobile, tablet, desktop, and wide desktop widths.

- Start with one-column flow and add columns at `md` or `lg`.
- Stack title/action groups and button rows on mobile.
- Avoid fixed horizontal padding such as `p-10` without a smaller mobile value.
- Allow tables to scroll horizontally or switch to a compact card/list representation.
- Keep tap targets at least 36px high; use larger targets for prominent mobile actions.
- Do not hide essential actions merely to make a layout fit.
- Inputs remain at least 16px on small screens through the global mobile override, preventing browser focus zoom.
- Use `svh`-based viewport sizing where full-height mobile layouts are required.

## Accessibility

- Preserve visible `focus-visible` rings from the shared primitives.
- Use semantic landmarks and heading order.
- Associate every form label with its control.
- Give icon-only controls an accessible name.
- Use actual `disabled` behavior for unavailable controls; `aria-disabled` alone does not prevent interaction.
- Do not communicate status, validation, or selection through color alone.
- Keep body text and controls at WCAG AA contrast in both themes.
- Ensure dialogs have titles and descriptions, and restore focus when they close.
- Respect keyboard navigation for all menus, forms, tabs, and composite widgets.
- Avoid unnecessary animation; new motion should honor `prefers-reduced-motion`.

## Patterns Not To Copy

Some existing code predates or diverges from the preferred system:

- Do not use `src/components/dashboard/Header.tsx` or `src/components/dashboard/Sidebar.tsx` as templates. The active shell lives in `src/components/layout`.
- Do not import `useTheme` from `next-themes`; use `src/contexts/theme-provider.tsx`.
- Do not copy hard-coded status class strings from dashboard list components into additional features. Extract a reusable variant.
- Do not use toast-only field validation as the default form pattern. Prefer the RHF/Zod form abstraction and inline messages.
- Do not copy plain-text loading and error branches from early settings pages. Use designed states.
- Do not assume every existing asset path is valid. Confirm it under `public`.
- Do not introduce another font. The root currently loads Inter, while the CSS font token naming needs consolidation; continue using `font-sans` so that correction remains centralized.

## Implementation Checklist

Before opening a pull request for UI work, confirm:

- The page uses the correct marketing, auth, dashboard, admin, or super-admin shell.
- Existing primitives and variants were reused before adding new ones.
- Colors use semantic tokens and work in light and dark themes.
- Mobile layout is intentional, not just a compressed desktop layout.
- Heading structure, labels, focus states, and icon names are accessible.
- Loading, empty, error, success, and pending states are covered where relevant.
- Buttons have the correct visual priority and destructive actions are confirmed.
- Copy is concise, consistent, and in Spanish.
- Images use valid paths, intentional dimensions, and appropriate alternative text.
- The page has been checked at mobile and desktop widths.
- `pnpm lint:check` and `pnpm build` pass.

