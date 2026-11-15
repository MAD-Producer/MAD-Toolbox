export function SplashScreen() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <DotsLoader />
    </div>
  );
}

function DotsLoader() {
  return (
    <span className="dots-loader" aria-hidden>
      {[0, 1, 2, 3, 4].map((index) => (
        <span
          key={index}
          className="dots-loader-dot"
          style={{ animationDelay: `${index * 100}ms` }}
        />
      ))}
    </span>
  );
}
