import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Font registration (optional, can use defaults)
// Font.register({ family: 'Helvetica', ... });

const styles = StyleSheet.create({
    page: {
        padding: 30,
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: '#333333',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eeeeee',
        paddingBottom: 10,
    },
    logoContainer: {
        width: '50%',
    },
    logo: {
        width: 120,
        marginBottom: 5,
    },
    doctorName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1a365d',
        marginBottom: 2,
    },
    doctorInfo: {
        fontSize: 8,
        color: '#666666',
    },
    invoiceInfoContainer: {
        width: '45%',
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    invoiceTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#1e40af',
    },
    invoiceDetail: {
        marginBottom: 3,
    },
    label: {
        fontWeight: 'bold',
        color: '#475569',
    },
    claveAcceso: {
        fontSize: 7,
        marginTop: 5,
        fontFamily: 'Courier',
    },
    qrCode: {
        width: 60,
        height: 60,
        marginTop: 5,
        alignSelf: 'flex-start',
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        backgroundColor: '#f1f5f9',
        padding: 5,
        marginTop: 15,
        marginBottom: 10,
        color: '#334155',
    },
    patientBox: {
        marginBottom: 15,
    },
    patientGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    gridItem: {
        width: '50%',
        marginBottom: 5,
    },
    table: {
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#1e40af',
        padding: 5,
        borderRadius: 2,
    },
    tableHeaderText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 9,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        padding: 5,
        alignItems: 'center',
    },
    colCode: { width: '15%' },
    colDesc: { width: '45%' },
    colCant: { width: '10%', textAlign: 'right' },
    colPrice: { width: '15%', textAlign: 'right' },
    colTotal: { width: '15%', textAlign: 'right' },

    summaryContainer: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    paymentsBox: {
        width: '55%',
    },
    totalsBox: {
        width: '40%',
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 5,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 3,
    },
    grandTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 5,
        paddingTop: 5,
        borderTopWidth: 1,
        borderTopColor: '#cbd5e1',
    },
    grandTotalText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1e40af',
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        textAlign: 'center',
        fontSize: 8,
        color: '#94a3b8',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 10,
    }
});

interface RIDEProps {
    factura: any; // Data from DB
    medico: any;  // Data from DB
    paciente: any;
    qrDataUrl: string;
}

const getPaymentLabel = (code: string) => {
    switch (code) {
        case '01': return 'SIN UTILIZACION DEL SISTEMA FINANCIERO';
        case '16': return 'TARJETA DE DEBITO';
        case '19': return 'TARJETA DE CREDITO';
        case '20': return 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO';
        default: return 'OTROS';
    }
};

export const RIDEGenerator: React.FC<RIDEProps> = ({ factura, medico, paciente, qrDataUrl }) => {
    const fechaEmision = factura.fechaEmision || new Date(factura.createdAt).toLocaleDateString();

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        {medico.logoUrl ? (
                            <Image src={medico.logoUrl} style={styles.logo} />
                        ) : (
                            <Text style={styles.doctorName}>{medico.nombreComercial || medico.nombre}</Text>
                        )}
                        <Text style={styles.doctorInfo}>{medico.direccion}</Text>
                        <Text style={styles.doctorInfo}>Telf: {medico.telefono || 'N/A'}</Text>
                        <Text style={styles.doctorInfo}>Contribuyente {medico.obligadoContabilidad ? 'OBLIGADO' : 'NO OBLIGADO'} A LLEVAR CONTABILIDAD</Text>
                    </View>

                    <View style={styles.invoiceInfoContainer}>
                        <Text style={styles.invoiceTitle}>R.U.C.: {medico.ruc}</Text>
                        <Text style={styles.invoiceTitle}>FACTURA</Text>
                        <Text style={styles.invoiceDetail}><Text style={styles.label}>No.: </Text>{medico.establecimiento}-{medico.puntoEmision}-{factura.secuencial}</Text>
                        <Text style={styles.invoiceDetail}><Text style={styles.label}>NÚMERO DE AUTORIZACIÓN: </Text></Text>
                        <Text style={styles.claveAcceso}>{factura.numeroAutorizacion || 'PENDIENTE'}</Text>
                        <Text style={styles.invoiceDetail}><Text style={styles.label}>FECHA Y HORA DE AUTORIZACIÓN: </Text>{factura.fechaAutorizacion ? new Date(factura.fechaAutorizacion).toLocaleString() : 'PENDIENTE'}</Text>
                        <Text style={styles.invoiceDetail}><Text style={styles.label}>AMBIENTE: </Text>{medico.ambiente || 'PRUEBAS'}</Text>
                        <Text style={styles.invoiceDetail}><Text style={styles.label}>EMISIÓN: </Text>NORMAL</Text>
                        <Text style={styles.invoiceDetail}><Text style={styles.label}>CLAVE DE ACCESO: </Text></Text>
                        <Image src={qrDataUrl} style={styles.qrCode} />
                        <Text style={styles.claveAcceso}>{factura.claveAcceso}</Text>
                    </View>
                </View>

                {/* Patient Info */}
                <View style={styles.patientBox}>
                    <Text style={styles.sectionTitle}>INFORMACIÓN DEL CLIENTE</Text>
                    <View style={styles.patientGrid}>
                        <View style={styles.gridItem}>
                            <Text><Text style={styles.label}>Razón Social: </Text>{paciente.razonSocial}</Text>
                        </View>
                        <View style={styles.gridItem}>
                            <Text><Text style={styles.label}>Identificación: </Text>{paciente.numeroIdentificacion}</Text>
                        </View>
                        <View style={styles.gridItem}>
                            <Text><Text style={styles.label}>Fecha Emisión: </Text>{fechaEmision}</Text>
                        </View>
                        <View style={styles.gridItem}>
                            <Text><Text style={styles.label}>Dirección: </Text>{paciente.direccion || 'N/A'}</Text>
                        </View>
                    </View>
                </View>

                {/* Items Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, styles.colCode]}>Cod. Ppal</Text>
                        <Text style={[styles.tableHeaderText, styles.colDesc]}>Descripción</Text>
                        <Text style={[styles.tableHeaderText, styles.colCant]}>Cant</Text>
                        <Text style={[styles.tableHeaderText, styles.colPrice]}>P. Unit</Text>
                        <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
                    </View>

                    {(factura.items || []).map((item: any, index: number) => (
                        <View key={index} style={styles.tableRow}>
                            <Text style={styles.colCode}>{item.codigoPrincipal || 'ITEM'}</Text>
                            <Text style={styles.colDesc}>{item.descripcion}</Text>
                            <Text style={styles.colCant}>{Number(item.cantidad).toFixed(2)}</Text>
                            <Text style={styles.colPrice}>{Number(item.precioUnitario).toFixed(2)}</Text>
                            <Text style={styles.colTotal}>{(item.cantidad * item.precioUnitario).toFixed(2)}</Text>
                        </View>
                    ))}
                </View>

                {/* Footer info: Payments and Totals */}
                <View style={styles.summaryContainer}>
                    <View style={styles.paymentsBox}>
                        <Text style={styles.label}>Información Adicional</Text>
                        {(factura.infoAdicional || []).map((info: any, index: number) => (
                            <Text key={index} style={{ fontSize: 8 }}>{info.nombre}: {info.valor}</Text>
                        ))}

                        <Text style={[styles.label, { marginTop: 10 }]}>Formas de Pago</Text>
                        <View style={{ marginTop: 5 }}>
                            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 2 }}>
                                <Text style={{ width: '70%', fontSize: 8, fontWeight: 'bold' }}>Descripción</Text>
                                <Text style={{ width: '30%', fontSize: 8, fontWeight: 'bold', textAlign: 'right' }}>Total</Text>
                            </View>
                            {(factura.formasPago || []).map((pago: any, index: number) => (
                                <View key={index} style={{ flexDirection: 'row', paddingTop: 2 }}>
                                    <Text style={{ width: '70%', fontSize: 8 }}>{getPaymentLabel(pago.codigo)}</Text>
                                    <Text style={{ width: '30%', fontSize: 8, textAlign: 'right' }}>{Number(pago.total).toFixed(2)}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    <View style={styles.totalsBox}>
                        <View style={styles.totalRow}>
                            <Text>SUBTOTAL 12%</Text>
                            <Text>{Number(factura.subtotal12 || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text>SUBTOTAL 15%</Text>
                            <Text>{Number(factura.subtotal15 || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text>SUBTOTAL 0%</Text>
                            <Text>{Number(factura.subtotal0 || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text>DESCUENTO</Text>
                            <Text>{Number(factura.descuento || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text>IVA</Text>
                            <Text>{Number(factura.iva || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.grandTotalRow}>
                            <Text style={styles.grandTotalText}>VALOR TOTAL</Text>
                            <Text style={styles.grandTotalText}>${Number(factura.total || 0).toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.footer}>Documento generado por MedicoFactura v1.0. Representación impresa de documento electrónico (RIDE).</Text>
            </Page>
        </Document>
    );
};
