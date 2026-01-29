import * as React from "react"

const RetroGrid = ({
  angle = 65,
  cellSize = 60,
  opacity = 0.5,
  lightLineColor = "gray",
  darkLineColor = "gray",
}) => {
  const gridStyles = {
    "--grid-angle": `${angle}deg`,
    "--cell-size": `${cellSize}px`,
    "--opacity": opacity,
    "--light-line": lightLineColor,
    "--dark-line": darkLineColor,
  } as React.CSSProperties

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={gridStyles}
    >
      {/* Money background image */}
      <div 
        className="absolute inset-0 z-[0] bg-cover bg-center bg-no-repeat opacity-50 dark:opacity-40"
        style={{
          backgroundImage: "url('/hero-money-bg.webp')",
          filter: "brightness(1.1) saturate(1.2) contrast(1.1)"
        }}
      />
      
      {/* Subtle overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-transparent dark:from-black/40 dark:via-black/20" />
      
      {/* Bottom fade gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent to-90% dark:from-black" />
    </div>
  )
}

export { RetroGrid }
