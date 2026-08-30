import { Center } from "@mantine/core";

export function SplashScreen() {
  return (
    <Center w="100%" mih="100vh" style={{ background: "var(--mantine-color-body)" }}>
      <DotsLoader />
    </Center>
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
