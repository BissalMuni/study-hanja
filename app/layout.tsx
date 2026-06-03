import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한자 지도 — 어문회 배정한자 학습",
  description: "글자·단어·관계·기출을 잇는 한자 지식 그래프",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
