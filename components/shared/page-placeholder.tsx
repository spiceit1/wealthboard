type Props = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: Props) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </main>
  );
}
