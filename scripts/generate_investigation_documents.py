from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIRS = [ROOT / "output" / "pdf", ROOT / "src" / "assets" / "documents"]
LOGO = ROOT / "src" / "assets" / "img" / "fg.png"

PAGE_WIDTH, PAGE_HEIGHT = A4
NAVY = colors.HexColor("#18324A")
BLUE = colors.HexColor("#285E86")
LIGHT_BLUE = colors.HexColor("#EAF2F8")
MUTED = colors.HexColor("#526173")
LINE = colors.HexColor("#A9B7C4")


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="FoundationTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=17,
        textColor=NAVY,
        spaceAfter=2,
    )
)
styles.add(
    ParagraphStyle(
        name="FoundationContact",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=MUTED,
    )
)
styles.add(
    ParagraphStyle(
        name="DocumentTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=17,
        alignment=TA_CENTER,
        textColor=NAVY,
        spaceBefore=5,
        spaceAfter=9,
    )
)
styles.add(
    ParagraphStyle(
        name="LegalBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.6,
        leading=13.2,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor("#17202A"),
        spaceAfter=7,
    )
)
styles.add(
    ParagraphStyle(
        name="LegalBodyCompact",
        parent=styles["LegalBody"],
        fontSize=8.9,
        leading=11.6,
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        name="SmallLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.2,
        leading=10,
        textColor=NAVY,
    )
)
styles.add(
    ParagraphStyle(
        name="SmallText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=10,
        textColor=colors.HexColor("#17202A"),
    )
)
styles.add(
    ParagraphStyle(
        name="Footer",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9,
        alignment=TA_CENTER,
        textColor=MUTED,
    )
)


def foundation_header():
    logo = Image(str(LOGO), width=24 * mm, height=24 * mm)
    contact = Paragraph(
        "<b>FONDATION GERVAIS</b><br/>"
        "9, avenue des Nations-Unies, Maman Mobutu, Mont-Ngafula - Kinshasa, RDC<br/>"
        "+243 825 333 567 &nbsp;|&nbsp; fondationgervais@gmail.com &nbsp;|&nbsp; fondationgervais.org",
        styles["FoundationContact"],
    )
    table = Table([[logo, contact]], colWidths=[29 * mm, 142 * mm])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return [table, Spacer(1, 3 * mm), HRFlowable(width="100%", thickness=1.2, color=BLUE), Spacer(1, 3 * mm)]


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, 13 * mm, PAGE_WIDTH - 20 * mm, 13 * mm)
    canvas.setFont("Helvetica", 7.3)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(PAGE_WIDTH / 2, 8.5 * mm, "Fondation Gervais - Document officiel")
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, 8.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def write_document(filename, story_factory):
    for output_dir in OUTPUT_DIRS:
        output_dir.mkdir(parents=True, exist_ok=True)
        path = output_dir / filename
        doc = SimpleDocTemplate(
            str(path),
            pagesize=A4,
            rightMargin=19 * mm,
            leftMargin=19 * mm,
            topMargin=14 * mm,
            bottomMargin=18 * mm,
            title=filename.replace("-", " ").replace(".pdf", "").title(),
            author="Fondation Gervais",
            subject="Modèle de document pour les vérificateurs",
        )
        doc.build(story_factory(), onFirstPage=footer, onLaterPages=footer)


def blank_line(width=72):
    return "_" * width


def build_mise_en_demeure():
    story = foundation_header()
    story.extend(
        [
            Paragraph("MISE EN DEMEURE", styles["DocumentTitle"]),
            Table(
                [[Paragraph("Kinshasa, le", styles["SmallLabel"]), Paragraph(blank_line(32), styles["SmallText"])]],
                colWidths=[27 * mm, 55 * mm],
                hAlign="RIGHT",
                style=TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ]
                ),
            ),
            Spacer(1, 4 * mm),
            Paragraph("Monsieur/Madame " + blank_line(53) + ",", styles["LegalBody"]),
            Paragraph(
                "Le paiement de la somme de " + blank_line(28) + " à l'intention de la "
                "« Fondation Gervais » était attendu de vous et, malgré nos multiples relances, "
                "il est arrivé à échéance et reste impayé depuis le " + blank_line(24) + ".",
                styles["LegalBody"],
            ),
            Paragraph(
                "La dette est liée à la somme que la « Fondation Gervais » avait mise à votre "
                "disposition afin de vous aider dans vos activités économiques.",
                styles["LegalBody"],
            ),
            Paragraph(
                "Sans préjudice de l'exercice de nos droits de recouvrement intégral de la dette, "
                "nous sommes disposés à accepter le montant de " + blank_line(24) + " à titre de "
                "règlement total et définitif de la dette, sous condition de paiement dans les "
                "12 jours à compter de la date de la présente.",
                styles["LegalBody"],
            ),
            Paragraph(
                "Veuillez noter que, dans le cas où la Fondation Gervais devrait entamer des "
                "procédures judiciaires pour obtenir le remboursement de la somme due, la présente "
                "lettre serait soumise au tribunal comme preuve de votre manquement à vouloir "
                "résoudre ce problème. En outre, vous pourriez être tenu(e) responsable des frais "
                "de tribunal, des frais d'avocats, des dommages et intérêts, ainsi que des dommages "
                "et intérêts punitifs.",
                styles["LegalBody"],
            ),
            Paragraph(
                "Il vous est conseillé de consulter un avocat pour discuter de vos droits et "
                "responsabilités juridiques.",
                styles["LegalBody"],
            ),
            Paragraph(
                "En espérant une réponse rapide de votre part, nous vous prions d'agréer, "
                "Monsieur/Madame, nos salutations les plus distinguées.",
                styles["LegalBody"],
            ),
            Spacer(1, 5 * mm),
            Table(
                [["", Paragraph("<b>Kusigomana Sumbu Royaume</b><br/>Conseiller juridique", styles["SmallText"])]],
                colWidths=[95 * mm, 76 * mm],
                style=TableStyle(
                    [
                        ("ALIGN", (1, 0), (1, 0), "CENTER"),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                    ]
                ),
            ),
        ]
    )
    return story


def field_row(label, width=70):
    return Paragraph(f"<b>{label}</b> {blank_line(width)}", styles["LegalBodyCompact"])


def signature_box(title):
    return [
        Paragraph(f"<b>{title}</b>", styles["SmallLabel"]),
        Spacer(1, 3 * mm),
        Paragraph("Nom : " + blank_line(21), styles["SmallText"]),
        Spacer(1, 7 * mm),
        Paragraph("Signature :", styles["SmallText"]),
        Spacer(1, 8 * mm),
        Paragraph("Date : " + blank_line(20), styles["SmallText"]),
    ]


def build_attestation():
    story = foundation_header()
    story.extend(
        [
            Paragraph("ATTESTATION DE PRISE EN CHARGE DU PAIEMENT", styles["DocumentTitle"]),
            Table(
                [
                    [Paragraph("<b>Référence :</b> " + blank_line(24), styles["SmallText"]),
                     Paragraph("<b>Kinshasa, le</b> " + blank_line(18), styles["SmallText"])],
                ],
                colWidths=[88 * mm, 83 * mm],
                style=TableStyle(
                    [
                        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ]
                ),
            ),
            Spacer(1, 4 * mm),
            Paragraph("<b>Entre les soussignés :</b>", styles["LegalBodyCompact"]),
            Paragraph(
                "<b>1. Le client initial :</b> Monsieur/Madame " + blank_line(40) + ", titulaire "
                "de la pièce d'identité n° " + blank_line(24) + ", client(e) de la Fondation "
                "Gervais sous la référence " + blank_line(27) + ".",
                styles["LegalBodyCompact"],
            ),
            Paragraph(
                "<b>2. La personne désignée :</b> Monsieur/Madame " + blank_line(36) + ", titulaire "
                "de la pièce d'identité n° " + blank_line(22) + ", téléphone " + blank_line(22) + ", "
                "demeurant à " + blank_line(54) + ".",
                styles["LegalBodyCompact"],
            ),
            Spacer(1, 2 * mm),
            Paragraph("<b>Il est convenu ce qui suit :</b>", styles["LegalBodyCompact"]),
            Paragraph(
                "Le client initial désigne la personne ci-dessus pour poursuivre, en son nom, le "
                "paiement dû à la Fondation Gervais. La personne désignée accepte et s'engage à "
                "payer le solde restant de " + blank_line(30) + " (montant en chiffres), soit "
                + blank_line(54) + " (montant en lettres), au plus tard le " + blank_line(24) + ".",
                styles["LegalBodyCompact"],
            ),
            Paragraph(
                "<b>Modalités convenues :</b> montant par versement " + blank_line(22) + " ; "
                "fréquence " + blank_line(20) + " ; premier versement le " + blank_line(22) + ".",
                styles["LegalBodyCompact"],
            ),
            Paragraph(
                "Cette prise en charge devient valable après signature de la Fondation Gervais. "
                "Elle ne change ni le montant dû ni la date limite. Jusqu'au paiement intégral, "
                "le client initial demeure responsable, sauf décharge écrite de la Fondation.",
                styles["LegalBodyCompact"],
            ),
            Paragraph(
                "Les trois parties déclarent avoir lu, compris et accepté la présente attestation, "
                "établie en trois exemplaires.",
                styles["LegalBodyCompact"],
            ),
            Spacer(1, 3 * mm),
            Table(
                [[signature_box("LE CLIENT INITIAL"), signature_box("LA PERSONNE DÉSIGNÉE"), signature_box("POUR LA FONDATION GERVAIS")]],
                colWidths=[57 * mm, 57 * mm, 57 * mm],
                rowHeights=[47 * mm],
                style=TableStyle(
                    [
                        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                        ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
                    ]
                ),
            ),
            Spacer(1, 3 * mm),
            Table(
                [[Paragraph("Mention manuscrite recommandée : <b>« Lu et approuvé »</b>", styles["SmallText"])]],
                colWidths=[171 * mm],
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BLUE),
                        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#C8D8E5")),
                        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                        ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
                    ]
                ),
            ),
            Spacer(1, 2 * mm),
            Paragraph("Fondation Gervais - Document à conserver par les trois parties", styles["Footer"]),
        ]
    )
    return story


if __name__ == "__main__":
    write_document("mise-en-demeure.pdf", build_mise_en_demeure)
    write_document("attestation-prise-en-charge-paiement.pdf", build_attestation)
    for output_dir in OUTPUT_DIRS:
        for name in ("mise-en-demeure.pdf", "attestation-prise-en-charge-paiement.pdf"):
            print(output_dir / name)
