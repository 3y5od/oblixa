import React from "react";
import { Document, Page, StyleSheet, Text, renderToBuffer } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, lineHeight: 1.35 },
  h1: { fontSize: 16, marginBottom: 10 },
  meta: { fontSize: 9, marginBottom: 12, color: "#52525b" },
  sectionTitle: { marginTop: 10, marginBottom: 6, fontSize: 10, color: "#18181b" },
  body: { fontSize: 8, marginBottom: 8 },
});

export async function renderDecisionPacketPdfBuffer(input: {
  title: string;
  packetType: string;
  exportedAt: string | null;
  bodyText: string;
}): Promise<Buffer> {
  const chunks: string[] = [];
  for (let i = 0; i < input.bodyText.length; i += 3500) {
    chunks.push(input.bodyText.slice(i, i + 3500));
  }
  const element = (
    <Document>
      {chunks.map((chunk, index) => (
        <Page size="A4" style={styles.page} key={`${index}`}>
          {index === 0 ? (
            <>
              <Text style={styles.h1}>{input.title}</Text>
              <Text style={styles.meta}>
                Packet type: {input.packetType}
                {input.exportedAt ? ` · Exported ${input.exportedAt}` : ""}
              </Text>
            </>
          ) : (
            <Text style={styles.sectionTitle}>Packet continuation · page {index + 1}</Text>
          )}
          <Text style={styles.body}>{chunk}</Text>
        </Page>
      ))}
    </Document>
  );
  return await renderToBuffer(element);
}
