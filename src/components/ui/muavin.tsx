// GradientBackground — "muavin", made with the 21st.dev Gradient
// Builder and exported as live CSS (the builder's own Copy-CSS background,
// plus its soften-blur and grain passes). Zero dependencies: one <div> that
// fills its parent. Drop it behind your content:
// <div className="relative h-96"><GradientBackground className="absolute inset-0" /></div>
// Remix the source recipe (colors, mode, finish) in the editor:
// https://21st.dev/community/gradients/editor?from=22a9f49a-e944-4b36-af69-2b41c3ded046
export function GradientBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        containerType: "size",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "-0.8cqmin",
          filter: "blur(0.4cqmin)",
          backgroundColor: "#000000",
          backgroundImage:
            "radial-gradient(circle at 65.34% 44.62%, rgba(95, 95, 95, 1) 0%, rgba(95, 95, 95, 0.844) 8.53%, rgba(95, 95, 95, 0.5) 17.05%, rgba(95, 95, 95, 0.156) 25.58%, rgba(95, 95, 95, 0) 34.1%), radial-gradient(circle at 28.07% 74.48%, rgba(53, 54, 48, 1) 0%, rgba(53, 54, 48, 0.844) 11.41%, rgba(53, 54, 48, 0.5) 22.83%, rgba(53, 54, 48, 0.156) 34.24%, rgba(53, 54, 48, 0) 45.65%), radial-gradient(circle at 52.42% 19.94%, rgba(56, 122, 56, 1) 0%, rgba(56, 122, 56, 0.844) 14.39%, rgba(56, 122, 56, 0.5) 28.77%, rgba(56, 122, 56, 0.156) 43.16%, rgba(56, 122, 56, 0) 57.55%), radial-gradient(circle at 80.31% 84.47%, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.844) 17.27%, rgba(0, 0, 0, 0.5) 34.55%, rgba(0, 0, 0, 0.156) 51.82%, rgba(0, 0, 0, 0) 69.1%)",
        }}
      />
    </div>
  )
}
