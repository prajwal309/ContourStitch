import { BufferAttribute, BufferGeometry, FileLoader, Loader } from 'three';

export const mannequinPath = '/models/quaternius-female/mannequin-v1.bin';

type MannequinGeometry = {
  surface: BufferGeometry;
  wireframe: BufferGeometry;
  frontGuides: BufferGeometry;
  otherGuides: BufferGeometry;
};

function makeGeometry(positions: BufferAttribute, indices?: Uint16Array) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', positions);
  if (indices) geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Reads the static buffer emitted by scripts/bake-mannequin.mjs. */
function decodeGeometry(buffer: ArrayBuffer): MannequinGeometry {
  const headerLength = 6 * Uint32Array.BYTES_PER_ELEMENT;
  const [
    magic,
    coordinates,
    frontCoordinates,
    otherCoordinates,
    triangles,
    edges,
  ] = new Uint32Array(buffer, 0, 6);
  const expectedBytes =
    headerLength +
    (2 * coordinates + frontCoordinates + otherCoordinates) * 4 +
    (triangles + edges) * 2;
  if (
    magic !== 0x3148534d ||
    expectedBytes !== buffer.byteLength ||
    coordinates === 0 ||
    coordinates % 3 !== 0 ||
    frontCoordinates % 6 !== 0 ||
    otherCoordinates % 6 !== 0 ||
    triangles % 3 !== 0 ||
    edges % 2 !== 0
  ) {
    throw new Error(
      'The illustrative mesh asset has an invalid buffer layout.',
    );
  }

  let offset = headerLength;
  const floats = (length: number) => {
    const array = new Float32Array(buffer, offset, length);
    offset += array.byteLength;
    return new BufferAttribute(array, 3);
  };
  const positions = floats(coordinates);
  const normals = floats(coordinates);
  const front = floats(frontCoordinates);
  const other = floats(otherCoordinates);
  const faces = new Uint16Array(buffer, offset, triangles);
  const lines = new Uint16Array(buffer, offset + faces.byteLength, edges);

  const surface = makeGeometry(positions, faces);
  surface.setAttribute('normal', normals);
  return {
    surface,
    wireframe: makeGeometry(positions, lines),
    frontGuides: makeGeometry(front),
    otherGuides: makeGeometry(other),
  };
}

/** useLoader caches the decoded immutable geometry by URL. */
export class MannequinLoader extends Loader<MannequinGeometry> {
  load(
    url: string,
    onLoad: (asset: MannequinGeometry) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ) {
    new FileLoader(this.manager).setResponseType('arraybuffer').load(
      url,
      (data) => {
        try {
          onLoad(decodeGeometry(data as ArrayBuffer));
        } catch (error) {
          onError?.(error);
        }
      },
      onProgress,
      onError,
    );
  }
}
