export const PROGRAM_CONFIG = {
    name: "Nombre pendiente",
    nameSlug: "nombre_pendiente",
    exportFileName: "respuestas_${nameSlug}.xlsx",

    instrumentOptions: {
        orquesta: [
            'Arpa', 'Clarinete', 'Contrabajo', 'Fagot', 'Flauta', 'Oboe',
            'Órgano', 'Percusión', 'Piano', 'Trombón', 'Trompa', 'Trompeta',
            'Tuba', 'Viola', 'Violín primero', 'Violín segundo', 'Violonchelo', 'Guitarra', 'Bajo', 'Otro'
        ],
        coro: ['Soprano', 'Alto', 'Tenor', 'Bajo', 'Otro']
    },

    afternoonRehearsals: [
        { date: '24/10/2026', label: 'Sábado 24 de octubre'},
        { date: '31/10/2026', label: 'Sábado 31 de octubre' }
    ]
};
