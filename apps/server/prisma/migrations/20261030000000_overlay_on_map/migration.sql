-- Mapa tirado da tela pelo "Remover" continua na biblioteca da cena
ALTER TABLE "MapOverlay" ADD COLUMN "isOnMap" BOOLEAN NOT NULL DEFAULT true;
