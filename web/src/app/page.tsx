import { Background } from "@/components/Background";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { ToolMarquee } from "@/components/sections/ToolMarquee";
import { Bento } from "@/components/sections/Bento";
import { DeepDive } from "@/components/sections/DeepDive";
import { Editions } from "@/components/sections/Editions";
import { OpenSource } from "@/components/sections/OpenSource";
import { DownloadCTA } from "@/components/sections/DownloadCTA";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <>
      <Background />
      <Navbar />
      <main className="relative z-10">
        <Hero />
        <ToolMarquee />
        <Bento />
        <DeepDive />
        <Editions />
        <OpenSource />
        <DownloadCTA />
        <Footer />
      </main>
    </>
  );
}
